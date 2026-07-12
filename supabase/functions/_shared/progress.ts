import type { Branch, LeafV2, SkillTreeV2, Trunk } from './tree-schema.ts'
import type { CandidateNode } from './candidates.ts'

// 進捗計算の純関数群。src/lib/progressCore.ts のミラー。変更時は同期すること。
// ルール:
// - Branch の done はここでは絶対に設定しない(クイズ合格 or サーバー検証のみ)
// - Branch progress は単調増加(葉由来と成果物由来の大きい方、done以外は99上限)
// - Trunk progress は core 枝のみの平均

export type DailyLogCoreInput = { studied_minutes?: number; completed: boolean }

export function computeLeafUpdate(leaf: LeafV2, log: DailyLogCoreInput, now = new Date().toISOString()): LeafV2 {
  if (leaf.status === 'done') return { ...leaf, recently_updated_at: now }
  if (log.completed) return { ...leaf, status: 'done', progress: 100, recently_updated_at: now }
  const minutes = log.studied_minutes ?? 0
  const delta = Math.round((100 * minutes) / Math.max(leaf.estimated_minutes, 15))
  const progress = Math.min(95, leaf.progress + Math.max(delta, 0))
  return { ...leaf, status: progress > 0 ? 'doing' : leaf.status, progress, recently_updated_at: now }
}

export function computeBranchProgress(leaves: LeafV2[]): number {
  if (leaves.length === 0) return 0
  return Math.round(leaves.reduce((sum, l) => sum + l.progress, 0) / leaves.length)
}

export function computeTrunkProgress(trunk: Trunk): number {
  const core = trunk.branches.filter((b) => b.kind === 'core')
  if (core.length === 0) return 0
  return Math.round(core.reduce((sum, b) => sum + b.progress, 0) / core.length)
}

export function recalcTree(tree: SkillTreeV2, leavesByBranch: Map<string, LeafV2[]>): { tree: SkillTreeV2; changedIds: string[] } {
  const changedIds: string[] = []
  const trunks = tree.trunks.map((trunk) => {
    let trunkChanged = false
    const branches = trunk.branches.map((b): Branch => {
      const rows = leavesByBranch.get(b.id)
      if (!rows || b.status === 'done') return b
      const fromLeaves = computeBranchProgress(rows)
      const progress = Math.min(99, Math.max(b.progress, fromLeaves))
      const status = b.status === 'unlocked' && progress > 0 ? 'in_progress' : b.status
      if (progress !== b.progress || status !== b.status) {
        changedIds.push(b.id)
        trunkChanged = true
        return { ...b, progress, status }
      }
      return b
    })
    const next: Trunk = { ...trunk, branches }
    const progress = computeTrunkProgress(next)
    if (progress !== trunk.progress) {
      changedIds.push(trunk.id)
      return { ...next, progress }
    }
    return trunkChanged ? next : trunk
  })
  return { tree: { ...tree, trunks }, changedIds }
}

export type ProgressEventInput = {
  node_type: 'trunk' | 'branch' | 'leaf'
  node_id: string
  source_type: 'quiz' | 'daily_log' | 'artifact' | 'manual' | 'system'
  source_id?: string
  progress_delta: number
  before_progress?: number
  after_progress?: number
  detail?: Record<string, unknown>
}

export function buildLeafProgressEvents(before: LeafV2, after: LeafV2, sourceType: ProgressEventInput['source_type']): ProgressEventInput[] {
  if (before.progress === after.progress && before.status === after.status) return []
  return [{
    node_type: 'leaf',
    node_id: after.id,
    source_type: sourceType,
    progress_delta: after.progress - before.progress,
    before_progress: before.progress,
    after_progress: after.progress,
    detail: { status: after.status },
  }]
}

// ---------------------------------------------------------------------------
// 成果物分類の検証・反映(サーバー側の正)
// ---------------------------------------------------------------------------

export type ArtifactMatchInput = {
  trunk_id: string
  branch_id: string
  leaf_id?: string
  confidence: number
  progress_delta: number
  completion_supported: boolean
  reason: string
  evidence_excerpt?: string
  tags: string[]
}

// AI返却の検証: 候補に存在するIDのみ許可、locked枝を除外、deltaを0-30にクランプ、合計50以下に縮尺
export function validateAnalysisMatches(raw: ArtifactMatchInput[], candidates: CandidateNode[], tree: SkillTreeV2): { valid: ArtifactMatchInput[]; dropped: string[] } {
  const candidateKeys = new Set(candidates.map((c) => (c.leaf_id ? `${c.trunk_id}/${c.branch_id}/${c.leaf_id}` : `${c.trunk_id}/${c.branch_id}`)))
  const branches = new Map(tree.trunks.flatMap((t) => t.branches).map((b) => [b.id, b]))
  const dropped: string[] = []
  let valid = raw.filter((m) => {
    const leafId = m.leaf_id && m.leaf_id.length > 0 ? m.leaf_id : undefined
    const key = leafId ? `${m.trunk_id}/${m.branch_id}/${leafId}` : `${m.trunk_id}/${m.branch_id}`
    const branch = branches.get(m.branch_id)
    if (!candidateKeys.has(key) || !branch || branch.status === 'locked' || !branch.revealed) {
      dropped.push(key)
      return false
    }
    return true
  }).map((m) => ({ ...m, leaf_id: m.leaf_id && m.leaf_id.length > 0 ? m.leaf_id : undefined, progress_delta: Math.max(0, Math.min(30, Math.round(m.progress_delta))) }))
  const total = valid.reduce((s, m) => s + m.progress_delta, 0)
  if (total > 50) {
    const scale = 50 / total
    valid = valid.map((m) => ({ ...m, progress_delta: Math.floor(m.progress_delta * scale) }))
  }
  return { valid, dropped }
}

export function tierMatches<T extends { confidence: number }>(matches: T[]): { auto: T[]; needsConfirm: T[]; recordOnly: T[] } {
  return {
    auto: matches.filter((m) => m.confidence >= 0.85),
    needsConfirm: matches.filter((m) => m.confidence >= 0.6 && m.confidence < 0.85),
    recordOnly: matches.filter((m) => m.confidence < 0.6),
  }
}

// 成果物マッチの反映。枝doneは設定しない(99上限)。葉は95上限でdoing。
export function applyMatchesServer(
  tree: SkillTreeV2,
  leavesByBranch: Map<string, LeafV2[]>,
  matches: ArtifactMatchInput[],
  submissionId: string,
  now = new Date().toISOString(),
): { tree: SkillTreeV2; leafUpserts: LeafV2[]; events: ProgressEventInput[]; updatedNodeIds: string[] } {
  const updatedNodeIds: string[] = []
  const leafUpserts: LeafV2[] = []
  const events: ProgressEventInput[] = []
  let trunks = tree.trunks
  for (const m of matches) {
    trunks = trunks.map((t) => {
      if (t.id !== m.trunk_id) return t
      const branches = t.branches.map((b): Branch => {
        if (b.id !== m.branch_id || b.status === 'locked' || b.status === 'done') return b
        const progress = Math.min(99, b.progress + m.progress_delta)
        const status = b.status === 'unlocked' && progress > 0 ? 'in_progress' as const : b.status
        const evidence = [...b.evidence, { id: `${b.id}-artifact-${submissionId.slice(0, 8)}-${events.length}`, type: 'artifact' as const, verified: false, created_at: now }]
        updatedNodeIds.push(b.id)
        events.push({ node_type: 'branch', node_id: b.id, source_type: 'artifact', source_id: submissionId, progress_delta: progress - b.progress, before_progress: b.progress, after_progress: progress, detail: { confidence: m.confidence } })
        if (m.leaf_id) {
          const rows = leavesByBranch.get(b.id) ?? []
          const leaf = rows.find((l) => l.id === m.leaf_id)
          if (leaf && leaf.status !== 'done') {
            const updated: LeafV2 = { ...leaf, progress: Math.min(95, leaf.progress + m.progress_delta * 2), status: 'doing', evidence_count: leaf.evidence_count + 1, recently_updated_at: now }
            leafUpserts.push(updated)
            leavesByBranch.set(b.id, rows.map((l) => (l.id === m.leaf_id ? updated : l)))
            updatedNodeIds.push(leaf.id)
            events.push({ node_type: 'leaf', node_id: leaf.id, source_type: 'artifact', source_id: submissionId, progress_delta: updated.progress - leaf.progress, before_progress: leaf.progress, after_progress: updated.progress, detail: {} })
          }
        }
        return { ...b, progress, status, evidence }
      })
      const next: Trunk = { ...t, branches }
      const progress = computeTrunkProgress(next)
      if (progress !== t.progress) updatedNodeIds.push(t.id)
      return { ...next, progress }
    })
  }
  return { tree: { ...tree, trunks }, leafUpserts, events, updatedNodeIds: [...new Set(updatedNodeIds)] }
}
