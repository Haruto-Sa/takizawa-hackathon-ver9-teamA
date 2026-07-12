import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { demoTree } from '../_shared/demo.ts'
import { normalizeTree } from '../_shared/tree-adapter.ts'
import { runGeneration } from '../_shared/generate.ts'
import * as treePrompt from '../_shared/prompts/generate-tree.ts'

Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const body = await req.json()
    if (typeof body.goal !== 'string' || !Array.isArray(body.tags)) return json({ error: 'invalid_input' }, 400)
    const db = admin()
    const treeId = crypto.randomUUID()
    const lc = (body.learning_conditions ?? null) as treePrompt.LearningConditions
    let fallback = false
    let tree
    try {
      const raw = await runGeneration({
        db, userId: user.id, functionName: 'generate-tree', prompt: treePrompt,
        input: { goal: body.goal, tags: body.tags, details: body.details ?? [], interests: String(body.interests ?? ''), learning_conditions: lc },
      })
      tree = treePrompt.assemble(raw, treeId)
    } catch {
      fallback = true
      tree = normalizeTree(demoTree(body.goal, String(body.interests ?? '')), { id: treeId })
    }
    const { error } = await db.from('trees').insert({ id: treeId, user_id: user.id, tree_data: tree, schema_version: 2, goal: tree.goal.title })
    if (error) throw error
    await db.from('profiles').upsert({
      id: user.id, goal: body.goal, interests: body.interests,
      learning_conditions: lc, onboarding_answers: { tags: body.tags, details: body.details ?? [], interests: body.interests ?? '' },
      updated_at: new Date().toISOString(),
    })
    return json({ id: treeId, tree, fallback })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
