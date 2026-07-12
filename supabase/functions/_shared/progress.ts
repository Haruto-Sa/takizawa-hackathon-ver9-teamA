import type { Branch, LeafV2, SkillTreeV2, Trunk } from './tree-schema.ts'

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
