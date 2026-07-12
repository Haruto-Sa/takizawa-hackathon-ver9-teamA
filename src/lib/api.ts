import { demoTree } from './demo'
import { ensureAnonymousSession, supabase } from './supabase'
import { quizResponseSchema, gradeResponseSchema, type PublicQuiz } from '../../shared/schemas/quiz'
import { skillTreeSchema, type SkillTree } from '../../shared/schemas/tree'
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

export async function generateTree(input: { goal: string; tags: string[]; details: string[]; interests: string }): Promise<{ id: string; tree: SkillTree }> {
  try { return await invoke('generate-tree', input, (v) => {
    const result = v as { id?: unknown; tree?: unknown }
    return { id: String(result.id ?? ''), tree: skillTreeSchema.parse(result.tree) }
  }) } catch { return { id: 'demo', tree: { ...demoTree, goal: input.goal } } }
}

export async function generateQuiz(treeId: string, nodeId: string): Promise<PublicQuiz> {
  if (treeId === 'demo') return { quiz_id: `demo-${nodeId}`, questions: [{ id: 'q1', prompt: 'JavaScriptで再代入できる変数を宣言するキーワードは？', choices: ['const', 'let', 'type', 'return'] }] }
  return invoke('generate-quiz', { tree_id: treeId, node_id: nodeId }, quizResponseSchema.parse)
}

export async function gradeQuiz(quizId: string, answers: number[]) {
  if (quizId.startsWith('demo-')) return gradeResponseSchema.parse({ passed: answers[0] === 1, score: answers[0] === 1 ? 1 : 0, explanations: ['let は再代入できる変数の宣言に使います。'] })
  return invoke('grade-quiz', { quiz_id: quizId, answers }, gradeResponseSchema.parse)
}

function buildLocalSummary(tree: SkillTree): ActivitySummary {
  const nodes = tree.milestones.flatMap((m) => m.nodes)
  const done = nodes.filter((n) => n.status === 'done')
  const working = nodes.filter((n) => n.status === 'in_progress' || n.status === 'unlocked')
  return {
    summary: `「${tree.goal}」に向けて、これまでに ${done.length} 件のスキルを習得しました。${working[0] ? `いまは「${working[0].label}」などに取り組んでいます。` : 'まずは最初のスキルに挑戦してみましょう。'}`,
    highlights: done.slice(0, 5).map((n) => n.label),
    next_steps: working.slice(0, 3).map((n) => n.label),
  }
}

export async function summarizeActivity(treeId: string, tree: SkillTree): Promise<ActivitySummary> {
  if (treeId === 'demo') return buildLocalSummary(tree)
  try { return await invoke('summarize-activity', { tree_id: treeId }, activitySummarySchema.parse) } catch { return buildLocalSummary(tree) }
}
