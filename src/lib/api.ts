import { applyDemoQuizPass, demoTreeV2 } from './demo'
import { normalizeTree } from './treeAdapter'
import { ensureAnonymousSession, supabase } from './supabase'
import { quizResponseSchema, gradeResponseSchema, type GradeResponse, type PublicQuiz } from '../../shared/schemas/quiz'
import type { SkillTreeV2 } from '../../shared/schemas/tree'
import { activitySummarySchema, type ActivitySummary } from '../../shared/schemas/activity'

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
