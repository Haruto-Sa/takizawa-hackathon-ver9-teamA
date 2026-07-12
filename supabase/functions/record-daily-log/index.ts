import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { ensureTreeV2, loadLeaves } from '../_shared/tree-adapter.ts'
import { buildLeafProgressEvents, computeLeafUpdate, recalcTree } from '../_shared/progress.ts'

// AI不使用。日次記録の保存・葉の状態更新・枝/木の進捗再計算・進捗イベントを
// apply_progress_transaction で1トランザクション適用する。
Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const body = await req.json()
    const { tree_id, branch_id, leaf_id } = body
    const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : null
    const studiedMinutes = Number.isInteger(body.studied_minutes) ? Math.max(0, Math.min(1440, body.studied_minutes)) : 0
    const completed = body.completed === true
    if (typeof tree_id !== 'string' || typeof branch_id !== 'string') return json({ error: 'invalid_input' }, 400)

    const db = admin()
    const { data: row } = await db.from('trees').select('id, user_id, tree_data').eq('id', tree_id).eq('user_id', user.id).maybeSingle()
    if (!row) return json({ error: 'not_found' }, 404)
    const tree = await ensureTreeV2(db, row)
    const branch = tree.trunks.flatMap((t) => t.branches).find((b) => b.id === branch_id)
    if (!branch || !branch.revealed) return json({ error: 'branch_not_found' }, 404)

    let leaves = await loadLeaves(db, tree_id, branch_id)
    const leafUpserts: unknown[] = []
    let events: unknown[] = []
    let updatedLeaf = null
    if (typeof leaf_id === 'string' && leaf_id.length > 0) {
      const leaf = leaves.find((l) => l.id === leaf_id)
      if (!leaf) return json({ error: 'leaf_not_found' }, 404)
      updatedLeaf = computeLeafUpdate(leaf, { studied_minutes: studiedMinutes, completed })
      leaves = leaves.map((l) => (l.id === leaf_id ? updatedLeaf! : l))
      leafUpserts.push(updatedLeaf)
      events = buildLeafProgressEvents(leaf, updatedLeaf, 'daily_log')
    }
    const { tree: nextTree, changedIds } = recalcTree(tree, new Map([[branch_id, leaves]]))
    const after = nextTree.trunks.flatMap((t) => t.branches).find((b) => b.id === branch_id)
    if (after && after.progress !== branch.progress) {
      events.push({ node_type: 'branch', node_id: branch_id, source_type: 'daily_log', progress_delta: after.progress - branch.progress, before_progress: branch.progress, after_progress: after.progress, detail: {} })
    }

    const { data: fresh } = await db.from('trees').select('updated_at').eq('id', tree_id).single()
    const { data: result, error } = await db.rpc('apply_progress_transaction', {
      p_user_id: user.id,
      p_tree_id: tree_id,
      p_expected_updated_at: fresh?.updated_at ?? null,
      p_tree_data: nextTree,
      p_leaf_upserts: leafUpserts,
      p_daily_log: { leaf_id: typeof leaf_id === 'string' ? leaf_id : null, branch_id, note, studied_minutes: studiedMinutes, completed },
      p_events: events,
      p_achievements: [],
    })
    if (error) return json({ error: error.message }, 409)
    const updated_node_ids = [...(updatedLeaf ? [updatedLeaf.id] : []), ...changedIds]
    return json({ log_id: (result as { log_id?: string })?.log_id ?? null, leaf: updatedLeaf, tree: nextTree, updated_node_ids })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
