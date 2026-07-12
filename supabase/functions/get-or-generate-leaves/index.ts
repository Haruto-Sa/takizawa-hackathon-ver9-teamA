import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { ensureTreeV2, loadLeaves } from '../_shared/tree-adapter.ts'
import { runGeneration } from '../_shared/generate.ts'
import * as leavesPrompt from '../_shared/prompts/generate-leaves.ts'

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type GeneratedLeaves = { leaves: Array<{ label: string; description: string; completion_condition: string; estimated_minutes: number }> }

const fallbackLeaves = (label: string): GeneratedLeaves => ({
  leaves: [
    { label: `${label}の基本を1つ試す`, description: '公式ドキュメントか入門記事を1本だけ読み、例を手元で動かす', completion_condition: '例が動いたスクリーンショットかメモを残す', estimated_minutes: 30 },
    { label: '小さな練習問題を解く', description: '学んだ内容の練習問題・演習を1〜2問解く', completion_condition: '解答と気づきをメモに残す', estimated_minutes: 30 },
    { label: '学んだことを3行でまとめる', description: '今日の学びを自分の言葉で要約する', completion_condition: '3行のまとめを書き終える', estimated_minutes: 15 },
    { label: '実際のコードに適用してみる', description: '手元のプロジェクトかサンドボックスで使ってみる', completion_condition: '動くコードを保存する', estimated_minutes: 45 },
    { label: 'ミニ成果物を作って保存する', description: '学んだ範囲だけで小さな成果物を作る', completion_condition: '成果物をGitHubかメモに保存する', estimated_minutes: 60 },
  ],
})

Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const { tree_id, branch_id } = await req.json()
    if (typeof tree_id !== 'string' || typeof branch_id !== 'string' || branch_id.length > 120) return json({ error: 'invalid_input' }, 400)
    const db = admin()
    const { data: row } = await db.from('trees').select('id, user_id, tree_data').eq('id', tree_id).eq('user_id', user.id).maybeSingle()
    if (!row) return json({ error: 'not_found' }, 404)
    const tree = await ensureTreeV2(db, row)
    const trunk = tree.trunks.find((t) => t.branches.some((b) => b.id === branch_id))
    const branch = trunk?.branches.find((b) => b.id === branch_id)
    if (!trunk || !branch || !branch.revealed) return json({ error: 'branch_not_found' }, 404)

    const existing = await loadLeaves(db, tree_id, branch_id)
    if (existing.length > 0) return json({ leaves: existing, generated: false })

    const { data: profile } = await db.from('profiles').select('learning_conditions').eq('id', user.id).maybeSingle()
    const lc = (profile?.learning_conditions ?? {}) as { version?: number; daily_minutes?: number; style?: string }
    const hash = await sha256(`${user.id}:${branch_id}:${lc.version ?? 0}`)
    const { error: lockError } = await db.from('leaf_generations').insert({ request_hash: hash, user_id: user.id, tree_id, branch_id })
    if (lockError) {
      // 同一リクエストの重複生成: 保存済みの葉を返す
      const again = await loadLeaves(db, tree_id, branch_id)
      return json({ leaves: again, generated: false })
    }

    let gen: GeneratedLeaves
    try {
      gen = await runGeneration({
        db, userId: user.id, functionName: 'get-or-generate-leaves', prompt: leavesPrompt,
        input: { goal: tree.goal.title, trunk_label: trunk.label, branch_label: branch.label, branch_description: branch.description, daily_minutes: lc.daily_minutes, style: lc.style },
      }) as GeneratedLeaves
    } catch {
      gen = fallbackLeaves(branch.label)
    }
    // AIのidは信用せず、サーバー側で採番する
    const rows = gen.leaves.map((l, i) => ({
      id: `${branch_id}-l${i + 1}`,
      user_id: user.id,
      tree_id,
      branch_id,
      label: l.label,
      description: l.description,
      completion_condition: l.completion_condition,
      estimated_minutes: Math.max(15, Math.min(240, l.estimated_minutes)),
      status: 'todo',
      progress: 0,
      evidence_count: 0,
    }))
    const { error: insertError } = await db.from('leaves').upsert(rows, { onConflict: 'tree_id,id', ignoreDuplicates: true })
    if (insertError) throw insertError
    const updatedTree = {
      ...tree,
      trunks: tree.trunks.map((t) => ({ ...t, branches: t.branches.map((b) => (b.id === branch_id ? { ...b, leaves_generated: true } : b)) })),
    }
    await db.from('trees').update({ tree_data: updatedTree, updated_at: new Date().toISOString() }).eq('id', tree_id)
    const leaves = await loadLeaves(db, tree_id, branch_id)
    return json({ leaves, generated: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
