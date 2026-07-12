import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { ensureTreeV2, loadLeaves } from '../_shared/tree-adapter.ts'
import { applyMatchesServer } from '../_shared/progress.ts'

Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const { match_id, accept } = await req.json()
    if (typeof match_id !== 'string') return json({ error: 'invalid_input' }, 400)
    const db = admin()
    const { data: match } = await db.from('artifact_matches').select('*').eq('id', match_id).eq('user_id', user.id).maybeSingle()
    if (!match) return json({ error: 'not_found' }, 404)
    const { data: row } = await db.from('trees').select('id, user_id, tree_data').eq('id', match.tree_id).eq('user_id', user.id).maybeSingle()
    if (!row) return json({ error: 'not_found' }, 404)
    const tree = await ensureTreeV2(db, row)

    // 二重反映防止: 既に適用済み・回答済みなら現状を返す
    if (match.applied || match.confirmed_by_user !== null) return json({ tree, updated_node_ids: [], already_answered: true })

    if (accept !== true) {
      await db.from('artifact_matches').update({ confirmed_by_user: false }).eq('id', match_id)
      return json({ tree, updated_node_ids: [] })
    }

    const leaves = await loadLeaves(db, match.tree_id)
    const leavesByBranch = new Map<string, typeof leaves>()
    leaves.forEach((l) => leavesByBranch.set(l.branch_id, [...(leavesByBranch.get(l.branch_id) ?? []), l]))
    const applied = applyMatchesServer(tree, leavesByBranch, [{
      trunk_id: match.trunk_id,
      branch_id: match.branch_id,
      leaf_id: match.leaf_id ?? undefined,
      confidence: Number(match.confidence),
      progress_delta: match.progress_delta,
      completion_supported: match.completion_supported,
      reason: match.reason,
      tags: (match.tags ?? []) as string[],
    }], match.submission_id)

    const { data: fresh } = await db.from('trees').select('updated_at').eq('id', match.tree_id).single()
    const { error: txError } = await db.rpc('apply_progress_transaction', {
      p_user_id: user.id,
      p_tree_id: match.tree_id,
      p_expected_updated_at: fresh?.updated_at ?? null,
      p_tree_data: applied.tree,
      p_leaf_upserts: applied.leafUpserts,
      p_events: applied.events,
      p_match_updates: [{ id: match_id, applied: true, confirmed_by_user: true }],
    })
    if (txError) return json({ error: txError.message }, 409)
    return json({ tree: applied.tree, updated_node_ids: applied.updatedNodeIds })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
