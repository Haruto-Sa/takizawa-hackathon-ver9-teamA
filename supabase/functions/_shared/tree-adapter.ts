import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { skillTreeSchema, skillTreeV2Schema, type Branch, type LeafV2, type LegacySkillNode, type LegacySkillTree, type SkillTreeV2, type Trunk } from './tree-schema.ts'

// legacy(v1)→v2 変換アダプタ。src/lib/treeAdapter.ts のミラー。変更時は同期すること。
// ensureTreeV2 は legacy 行を初回読み込み時に v2 へ変換して永続化する(冪等)。

export function isV2Tree(value: unknown): value is SkillTreeV2 {
  return typeof value === 'object' && value !== null && (value as { schema_version?: unknown }).schema_version === 2
}

function legacyNodeToBranch(node: LegacySkillNode, trunkId: string): Branch {
  const evidence = node.evidence
    ? [{
        id: `${node.id}-quiz`,
        type: 'quiz' as const,
        verified: true,
        ...(typeof node.evidence.detail?.score === 'number' ? { score: Number(node.evidence.detail.score) } : {}),
        created_at: node.evidence.passed_at,
      }]
    : []
  return {
    id: node.id,
    trunk_id: trunkId,
    label: node.label,
    description: node.how_to_learn,
    kind: node.kind === 'hidden' ? 'hidden' : 'core',
    status: node.status,
    progress: node.status === 'done' ? 100 : node.status === 'in_progress' ? 40 : 0,
    estimated_days: 7,
    prerequisite_ids: node.prerequisite_ids,
    leaves_generated: node.leaves.length > 0,
    revealed: true,
    evidence,
    related: node.related,
    leaves: node.leaves.map((l): LeafV2 => ({
      id: l.id,
      branch_id: node.id,
      label: l.label,
      description: l.description,
      completion_condition: '',
      estimated_minutes: 30,
      status: l.status === 'done' ? 'done' : 'todo',
      progress: l.status === 'done' ? 100 : 0,
      evidence_count: 0,
    })),
  }
}

function legacyToV2(tree: LegacySkillTree, id: string): SkillTreeV2 {
  const trunks: Trunk[] = tree.milestones.map((m, index) => {
    const branches = m.nodes.map((n) => legacyNodeToBranch(n, m.id))
    const done = branches.filter((b) => b.status === 'done').length
    return {
      id: m.id,
      label: m.label,
      description: '',
      order: index,
      status: m.status,
      progress: branches.length ? Math.round((done / branches.length) * 100) : 0,
      prerequisite_ids: [],
      branches,
    }
  })
  return {
    schema_version: 2,
    id,
    goal: { title: tree.goal },
    start: { summary: '現在地', assessed_at: new Date().toISOString() },
    trunks,
  }
}

export function normalizeTree(input: unknown, opts?: { id?: string }): SkillTreeV2 {
  if (isV2Tree(input)) {
    const parsed = skillTreeV2Schema.parse(input)
    return opts?.id ? { ...parsed, id: opts.id } : parsed
  }
  const legacy = skillTreeSchema.parse(input)
  return skillTreeV2Schema.parse(legacyToV2(legacy, opts?.id ?? 'local'))
}

type TreeRow = { id: string; user_id: string; tree_data: unknown }

// legacy 行を v2 へ変換して永続化する(冪等)。埋込葉は leaves テーブルへ移設し、
// tree_data からは取り除く。返すツリーには葉を含まない(呼び出し側で leaves を別途 select)。
export async function ensureTreeV2(db: SupabaseClient, row: TreeRow): Promise<SkillTreeV2> {
  if (isV2Tree(row.tree_data)) {
    return skillTreeV2Schema.parse(row.tree_data)
  }
  const v2 = normalizeTree(row.tree_data, { id: row.id })
  const leafRows: Array<Record<string, unknown>> = []
  const stripped: SkillTreeV2 = {
    ...v2,
    trunks: v2.trunks.map((t) => ({
      ...t,
      branches: t.branches.map((b) => {
        for (const l of b.leaves ?? []) {
          leafRows.push({
            id: l.id,
            user_id: row.user_id,
            tree_id: row.id,
            branch_id: b.id,
            label: l.label,
            description: l.description,
            completion_condition: l.completion_condition,
            estimated_minutes: l.estimated_minutes,
            status: l.status,
            progress: l.progress,
            evidence_count: l.evidence_count,
          })
        }
        const rest = { ...b }
        delete rest.leaves
        return rest
      }),
    })),
  }
  if (leafRows.length > 0) {
    const { error } = await db.from('leaves').upsert(leafRows, { onConflict: 'tree_id,id', ignoreDuplicates: true })
    if (error) throw error
  }
  const { error } = await db.from('trees')
    .update({ tree_data: stripped, schema_version: 2, goal: stripped.goal.title })
    .eq('id', row.id)
    .eq('schema_version', 1)
  if (error) throw error
  return stripped
}

export async function loadLeaves(db: SupabaseClient, treeId: string, branchId?: string): Promise<LeafV2[]> {
  let query = db.from('leaves').select('id, branch_id, label, description, completion_condition, estimated_minutes, scheduled_date, status, progress, evidence_count, recently_updated_at').eq('tree_id', treeId)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    branch_id: r.branch_id as string,
    label: r.label as string,
    description: (r.description as string) ?? '',
    completion_condition: (r.completion_condition as string) ?? '',
    estimated_minutes: (r.estimated_minutes as number) ?? 30,
    ...(r.scheduled_date ? { scheduled_date: String(r.scheduled_date) } : {}),
    status: r.status as LeafV2['status'],
    progress: (r.progress as number) ?? 0,
    evidence_count: (r.evidence_count as number) ?? 0,
    ...(r.recently_updated_at ? { recently_updated_at: String(r.recently_updated_at) } : {}),
  }))
}
