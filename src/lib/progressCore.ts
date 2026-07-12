import type { Branch, LeafV2, SkillTreeV2, Trunk } from '../../shared/schemas/tree'
import type { ArtifactMatch } from '../../shared/schemas/artifact'

// 進捗計算の純関数群(唯一の正)。supabase/functions/_shared/progress.ts にミラーがある。
// 変更時は同期すること。
//
// ルール:
// - Branch の done はここでは絶対に設定しない(クイズ合格 or サーバー検証のみ)
// - Branch progress は単調増加(葉由来と成果物由来の大きい方を採用、done以外は99上限)
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

// 葉の状態からツリー全体の progress を再計算する。
// 返り値の changedIds は進捗・状態が変わった branch/trunk の id。
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

// 確信度による3段階振り分け(v2 §7.4): 0.85以上=自動反映 / 0.60〜0.84=要確認 / 0.60未満=記録のみ
export function tierMatches(matches: ArtifactMatch[]): { auto: ArtifactMatch[]; needsConfirm: ArtifactMatch[]; recordOnly: ArtifactMatch[] } {
  return {
    auto: matches.filter((m) => m.confidence >= 0.85),
    needsConfirm: matches.filter((m) => m.confidence >= 0.6 && m.confidence < 0.85),
    recordOnly: matches.filter((m) => m.confidence < 0.6),
  }
}

// 成果物マッチをツリーへ反映する。枝の done は絶対に設定しない(progressは99上限)。
// locked/done の枝はスキップ。葉は progress を進めるが done 化は行わない(95上限)。
export function applyMatches(tree: SkillTreeV2, matches: ArtifactMatch[], now = new Date().toISOString()): { tree: SkillTreeV2; updatedNodeIds: string[] } {
  const updatedNodeIds: string[] = []
  let trunks = tree.trunks
  for (const m of matches) {
    trunks = trunks.map((t) => {
      if (t.id !== m.trunk_id) return t
      const branches = t.branches.map((b): Branch => {
        if (b.id !== m.branch_id || b.status === 'locked' || b.status === 'done') return b
        const progress = Math.min(99, b.progress + m.progress_delta)
        const status = b.status === 'unlocked' && progress > 0 ? 'in_progress' as const : b.status
        const evidence = [...b.evidence, { id: `${b.id}-artifact-${now}-${updatedNodeIds.length}`, type: 'artifact' as const, verified: false, created_at: now }]
        updatedNodeIds.push(b.id)
        const leaves = m.leaf_id && b.leaves
          ? b.leaves.map((l): LeafV2 => {
              if (l.id !== m.leaf_id || l.status === 'done') return l
              updatedNodeIds.push(l.id)
              return { ...l, progress: Math.min(95, l.progress + m.progress_delta * 2), status: 'doing', evidence_count: l.evidence_count + 1, recently_updated_at: now }
            })
          : b.leaves
        return { ...b, progress, status, evidence, ...(leaves ? { leaves } : {}) }
      })
      const next: Trunk = { ...t, branches }
      const progress = computeTrunkProgress(next)
      if (progress !== t.progress) updatedNodeIds.push(t.id)
      return { ...next, progress }
    })
  }
  return { tree: { ...tree, trunks }, updatedNodeIds: [...new Set(updatedNodeIds)] }
}
