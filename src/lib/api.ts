import { z } from 'zod'
import { applyDemoQuizPass, demoTreeV2 } from './demo'
import { normalizeTree } from './treeAdapter'
import { ensureAnonymousSession, supabase } from './supabase'
import { quizResponseSchema, gradeResponseSchema, type GradeResponse, type PublicQuiz } from '../../shared/schemas/quiz'
import { leafV2Schema, type LeafV2, type SkillTreeV2 } from '../../shared/schemas/tree'
import { activitySummarySchema, type ActivitySummary } from '../../shared/schemas/activity'
import { analyzeArtifactResponseSchema, type ArtifactAnalysis, type ArtifactMatch, type ArtifactSourceType } from '../../shared/schemas/artifact'
import { classifyArtifactLocally } from './candidateCore'
import { applyMatches, tierMatches } from './progressCore'
import { detectSecrets, maskSecrets } from './artifactRules'

async function invoke<T>(name: string, body: Record<string, unknown>, parse: (value: unknown) => T): Promise<T> {
  await ensureAnonymousSession()
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw error
  return parse(data)
}

export async function generateQuestions(goal: string, tags: string[]) {
  try { return await invoke('generate-questions', { goal, tags }, (v) => {
    const result = v as { questions?: unknown }
    if (!Array.isArray(result.questions) || !result.questions.every((q) => typeof q === 'string')) throw new Error('Invalid questions')
    return result.questions.slice(0, 2)
  }) } catch { return ['これまでに作ったもの、または挑戦したことを教えてください。'] }
}

export type GenerateTreeInput = {
  goal: string
  tags: string[]
  details: string[]
  interests: string
  learning_conditions?: Record<string, unknown>
}

export async function generateTree(input: GenerateTreeInput): Promise<{ id: string; tree: SkillTreeV2 }> {
  try { return await invoke('generate-tree', input, (v) => {
    const result = v as { id?: unknown; tree?: unknown }
    const id = String(result.id ?? '')
    return { id, tree: normalizeTree(result.tree, { id }) }
  }) } catch { return { id: 'demo', tree: { ...demoTreeV2, goal: { ...demoTreeV2.goal, title: input.goal } } } }
}

export async function generateQuiz(treeId: string, nodeId: string): Promise<PublicQuiz> {
  if (treeId === 'demo') return { quiz_id: `demo-${nodeId}`, questions: [{ id: 'q1', prompt: 'JavaScriptで再代入できる変数を宣言するキーワードは？', choices: ['const', 'let', 'type', 'return'] }] }
  return invoke('generate-quiz', { tree_id: treeId, node_id: nodeId }, quizResponseSchema.parse)
}

export async function gradeQuiz(quizId: string, answers: number[], ctx?: { tree: SkillTreeV2; branchId: string }): Promise<GradeResponse> {
  if (quizId.startsWith('demo-')) {
    const passed = answers[0] === 1
    return gradeResponseSchema.parse({
      passed,
      score: passed ? 1 : 0,
      explanations: ['let は再代入できる変数の宣言に使います。'],
      tree: passed && ctx ? applyDemoQuizPass(ctx.tree, ctx.branchId) : undefined,
    })
  }
  return invoke('grade-quiz', { quiz_id: quizId, answers }, gradeResponseSchema.parse)
}

function buildLocalSummary(tree: SkillTreeV2): ActivitySummary {
  const branches = tree.trunks.flatMap((t) => t.branches)
  const done = branches.filter((b) => b.status === 'done')
  const working = branches.filter((b) => b.status === 'in_progress' || b.status === 'unlocked')
  return {
    summary: `「${tree.goal.title}」に向けて、これまでに ${done.length} 件のスキルを習得しました。${working[0] ? `いまは「${working[0].label}」などに取り組んでいます。` : 'まずは最初のスキルに挑戦してみましょう。'}`,
    highlights: done.slice(0, 5).map((b) => b.label),
    next_steps: working.slice(0, 3).map((b) => b.label),
  }
}

export async function summarizeActivity(treeId: string, tree: SkillTreeV2): Promise<ActivitySummary> {
  if (treeId === 'demo') return buildLocalSummary(tree)
  try { return await invoke('summarize-activity', { tree_id: treeId }, activitySummarySchema.parse) } catch { return buildLocalSummary(tree) }
}

// ---------------------------------------------------------------------------
// ツリー・葉・日次記録
// ---------------------------------------------------------------------------

export async function getTree(treeId: string): Promise<{ tree: SkillTreeV2; leaves: LeafV2[] } | null> {
  if (treeId === 'demo') return null
  try {
    return await invoke('get-tree', { tree_id: treeId }, (v) => {
      const r = v as { tree?: unknown; leaves?: unknown }
      return { tree: normalizeTree(r.tree, { id: treeId }), leaves: z.array(leafV2Schema).parse(r.leaves ?? []) }
    })
  } catch { return null }
}

function demoLeafTemplates(branchId: string, label: string): LeafV2[] {
  const mk = (i: number, l: string, d: string, c: string, m: number): LeafV2 => ({ id: `${branchId}-l${i}`, branch_id: branchId, label: l, description: d, completion_condition: c, estimated_minutes: m, status: 'todo', progress: 0, evidence_count: 0 })
  return [
    mk(1, `${label}の基本を1つ試す`, '入門記事を1本読み、例を手元で動かす', '動いた結果をメモに残す', 30),
    mk(2, '小さな練習問題を解く', '学んだ内容の演習を1〜2問解く', '解答と気づきをメモする', 30),
    mk(3, '学んだことを3行でまとめる', '自分の言葉で要約する', '3行のまとめを書き終える', 15),
    mk(4, '実際のコードに適用してみる', 'サンドボックスで使ってみる', '動くコードを保存する', 45),
    mk(5, 'ミニ成果物を作って保存する', '学んだ範囲で小さな成果物を作る', 'GitHubかメモに保存する', 60),
  ]
}

export async function getOrGenerateLeaves(treeId: string, branchId: string, branchLabel: string): Promise<{ leaves: LeafV2[]; generated: boolean }> {
  if (treeId === 'demo') {
    await new Promise((r) => setTimeout(r, 700))
    return { leaves: demoLeafTemplates(branchId, branchLabel), generated: true }
  }
  try {
    return await invoke('get-or-generate-leaves', { tree_id: treeId, branch_id: branchId }, (v) => {
      const r = v as { leaves?: unknown; generated?: unknown }
      return { leaves: z.array(leafV2Schema).parse(r.leaves ?? []), generated: Boolean(r.generated) }
    })
  } catch { return { leaves: demoLeafTemplates(branchId, branchLabel), generated: true } }
}

export type RecordDailyLogInput = { treeId: string; branchId: string; leafId?: string; note: string; studiedMinutes: number; completed: boolean }

// サーバー(record-daily-log)を優先。失敗時は呼び出し側でローカル反映にフォールバックする。
export async function recordDailyLog(input: RecordDailyLogInput): Promise<{ tree: SkillTreeV2; leaf: LeafV2 | null; updatedNodeIds: string[] }> {
  return invoke('record-daily-log', {
    tree_id: input.treeId,
    branch_id: input.branchId,
    leaf_id: input.leafId,
    note: input.note,
    studied_minutes: input.studiedMinutes,
    completed: input.completed,
  }, (v) => {
    const r = v as { tree?: unknown; leaf?: unknown; updated_node_ids?: unknown }
    return {
      tree: normalizeTree(r.tree, { id: input.treeId }),
      leaf: r.leaf ? leafV2Schema.parse(r.leaf) : null,
      updatedNodeIds: z.array(z.string()).parse(r.updated_node_ids ?? []),
    }
  })
}

// ---------------------------------------------------------------------------
// 投稿(成果物・学習メモ・差分)のAI整理
// サーバーの analyze-artifact を優先し、未接続・失敗時はローカル簡易分類器で判定する。
// ---------------------------------------------------------------------------

export type AnalyzeArtifactInput = {
  treeId: string
  tree: SkillTreeV2
  source_type: ArtifactSourceType
  title?: string
  note?: string
  text: string
  focusedBranchId?: string
}

export type AnalyzeArtifactResult = {
  analysis: ArtifactAnalysis
  autoApplied: ArtifactMatch[]
  needsConfirm: ArtifactMatch[]
  tree: SkillTreeV2
  updatedNodeIds: string[]
  source: 'server' | 'local'
}

function analyzeLocally(input: AnalyzeArtifactInput): AnalyzeArtifactResult {
  const masked = maskSecrets(input.text)
  const analysis = classifyArtifactLocally(input.tree, { text: `${input.note ?? ''}\n${masked}`, focusedBranchId: input.focusedBranchId })
  const secrets = detectSecrets(input.text)
  if (secrets.length > 0) analysis.warnings = [...analysis.warnings, `秘密情報らしき文字列(${secrets.join('、')})を検出したためマスクしました`]
  const { auto, needsConfirm } = tierMatches(analysis.matches)
  const applied = applyMatches(input.tree, auto)
  return { analysis, autoApplied: auto, needsConfirm, tree: applied.tree, updatedNodeIds: applied.updatedNodeIds, source: 'local' }
}

export async function analyzeArtifact(input: AnalyzeArtifactInput): Promise<AnalyzeArtifactResult> {
  if (input.treeId === 'demo') return analyzeLocally(input)
  try {
    const res = await invoke('analyze-artifact', {
      tree_id: input.treeId,
      focused_branch_id: input.focusedBranchId,
      source_type: input.source_type,
      title: input.title,
      note: input.note,
      text_content: input.text,
    }, analyzeArtifactResponseSchema.parse)
    const tree = res.tree ? normalizeTree(res.tree, { id: input.treeId }) : input.tree
    const applied = res.analysis.matches.filter((m) => m.confidence >= 0.85)
    return { analysis: res.analysis, autoApplied: applied, needsConfirm: res.needs_confirmation, tree, updatedNodeIds: res.updated_node_ids, source: 'server' }
  } catch {
    return analyzeLocally(input)
  }
}

// 中確信度マッチのユーザー確認。サーバー未接続時はローカル反映。
export async function confirmArtifactMatch(treeId: string, tree: SkillTreeV2, match: ArtifactMatch): Promise<{ tree: SkillTreeV2; updatedNodeIds: string[] }> {
  // TODO(backend): confirm-artifact-match Edge Function 接続(重複反映防止はサーバー側で行う)
  void treeId
  return applyMatches(tree, [match])
}
