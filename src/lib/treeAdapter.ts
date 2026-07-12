import { skillTreeSchema, skillTreeV2Schema } from '../../shared/schemas/tree'
import type { Branch, LeafV2, SkillNode, SkillTree, SkillTreeV2, Trunk } from '../../shared/schemas/tree'

// legacy(v1: milestones/nodes/leaves) と v2(trunks/branches/leaves) の変換アダプタ。
// supabase/functions/_shared/tree-adapter.ts にミラーがある。変更時は同期すること。

export function isV2Tree(value: unknown): value is SkillTreeV2 {
  return typeof value === 'object' && value !== null && (value as { schema_version?: unknown }).schema_version === 2
}

function legacyNodeToBranch(node: SkillNode, trunkId: string): Branch {
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
    revealed: true, // legacyのhiddenは既に表示済みの★スキルなので隠さない
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

function legacyToV2(tree: SkillTree, id: string): SkillTreeV2 {
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

// DBのleaves行をツリーへマージする。DB行が常に正で、埋め込み葉より優先する。
export function attachLeaves(tree: SkillTreeV2, leaves: LeafV2[]): SkillTreeV2 {
  if (leaves.length === 0) return tree
  const byBranch = new Map<string, LeafV2[]>()
  leaves.forEach((l) => {
    const list = byBranch.get(l.branch_id) ?? []
    list.push(l)
    byBranch.set(l.branch_id, list)
  })
  return {
    ...tree,
    trunks: tree.trunks.map((t) => ({
      ...t,
      branches: t.branches.map((b) => {
        const rows = byBranch.get(b.id)
        return rows ? { ...b, leaves: rows, leaves_generated: true } : b
      }),
    })),
  }
}
