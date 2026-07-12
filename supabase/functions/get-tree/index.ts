import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { ensureTreeV2, loadLeaves } from '../_shared/tree-adapter.ts'

Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const { tree_id } = await req.json()
    if (typeof tree_id !== 'string') return json({ error: 'invalid_input' }, 400)
    const db = admin()
    const { data: row } = await db.from('trees').select('id, user_id, tree_data').eq('id', tree_id).eq('user_id', user.id).maybeSingle()
    if (!row) return json({ error: 'not_found' }, 404)
    const tree = await ensureTreeV2(db, row)
    const leaves = await loadLeaves(db, tree_id)
    return json({ tree, leaves })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
