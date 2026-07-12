import type { Edge } from '@xyflow/react'
import type { Branch, SkillTreeV2 } from '../../shared/schemas/tree'
import type { TreeViewState } from '../hooks/useTreeNavigation'
import type { BranchFlowNode } from '../components/tree/BranchNodeCard'
import type { JointFlowNode, LeafFlowNode, StartFlowNode, SubFlowNode, TrunkFlowNode } from '../components/tree/nodes'

export type TreeFlowNode = BranchFlowNode | StartFlowNode | TrunkFlowNode | JointFlowNode | SubFlowNode | LeafFlowNode

// 木(Trunk)ごとに循環するネオンアクセント
export const ACCENTS = ['#67e8f9', '#f0abfc', '#6ee7b7', '#fcd34d', '#a5b4fc', '#5eead4']

const CARD_W = 220
const CARD_H = 66
const TRUNK_W = 190
const TRUNK_H = 46
const START_SIZE = 104
const JOINT_SIZE = 8
const SUB_W = 160
const SUB_H = 52
// 全体/木ビューでは葉は小さな芽(ドット)として表示し、重なりを防ぐ
const BUD_SIZE = 14
const BUD_GAP = 18
const BUD_DY = 20
// 枝フォーカスビューの葉ピル
const LEAF_W = 150
const LEAF_H = 40
const BRANCH_DX = 90
const SIDE_QUEST_EXTRA = 130 // side questは幹からさらに外側へ
const SUB_GAP = 56
const SUB_DY = 62
const ROW_BASE = 112
const TRUNK_ROW = 104
const START_ROW = 136
const LEAF_COLOR = '#4ade80'
const SIDE_QUEST_COLOR = '#f5c34d'
const TRUNK_EDGE = '#3b5a72'
const FOCUS_DIM = { opacity: 0.07, pointerEvents: 'none' as const }

export type BuildFlowOptions = {
  recentlyUpdatedIds?: Set<string>
  revealingIds?: Set<string>
}

// 前提スキルが幹の下側に来るよう並べ替え
function topoSort(branches: Branch[]): Branch[] {
  const byId = new Map(branches.map((b) => [b.id, b]))
  const visited = new Set<string>()
  const out: Branch[] = []
  const visit = (b: Branch) => {
    if (visited.has(b.id)) return
    visited.add(b.id)
    b.prerequisite_ids.forEach((id) => {
      const p = byId.get(id)
      if (p) visit(p)
    })
    out.push(b)
  }
  branches.forEach(visit)
  return out
}

// viewに応じて 全体/木/枝/葉 の4段階レイアウトを生成する。
// trunk: 選択木以外をフェード。branch/leaf: 選択枝を中心に葉・関連技術を円形展開。
export function buildFlow(tree: SkillTreeV2, view: TreeViewState, opts?: BuildFlowOptions): { nodes: TreeFlowNode[]; edges: Edge[]; focusIds: string[] } {
  const nodes: TreeFlowNode[] = []
  const edges: Edge[] = []
  const spine: string[] = []
  const focusIds: string[] = []
  const glowIds = opts?.recentlyUpdatedIds ?? new Set<string>()
  const revealingIds = opts?.revealingIds ?? new Set<string>()
  const focusedBranchId = view.mode === 'branch' || view.mode === 'leaf' ? view.branchId : null
  const focusedTrunkId = view.mode === 'trunk' ? view.trunkId : null
  const focusedLeafId = view.mode === 'leaf' ? view.leafId : null
  let y = 0
  let sideFlip = 0

  const put = (node: TreeFlowNode, cx: number, cy: number, w: number, h: number, dimmed: boolean) => {
    node.position = { x: cx - w / 2, y: cy - h / 2 }
    if (dimmed) node.style = FOCUS_DIM
    nodes.push(node)
  }
  const classFor = (rawId: string, base?: string) => {
    const cls = [base, glowIds.has(rawId) ? 'node-glow' : '', revealingIds.has(rawId) ? 'node-reveal' : ''].filter(Boolean).join(' ')
    return cls || undefined
  }

  const dimAll = view.mode !== 'overview'
  put({ id: '__start', type: 'start', data: { goal: tree.goal.title }, position: { x: 0, y: 0 } }, 0, y, START_SIZE, START_SIZE, dimAll)
  spine.push('__start')

  const orderedTrunks = [...tree.trunks].sort((a, b) => a.order - b.order)
  orderedTrunks.forEach((trunk, ti) => {
    const accent = ACCENTS[ti % ACCENTS.length]
    const inFocusedTrunk = trunk.id === focusedTrunkId
    y -= spine.length === 1 ? START_ROW : TRUNK_ROW
    put(
      { id: trunk.id, type: 'trunk', data: { label: trunk.label, status: trunk.status, accent, progress: trunk.progress }, position: { x: 0, y: 0 }, className: classFor(trunk.id) },
      0, y, TRUNK_W, TRUNK_H,
      dimAll && !inFocusedTrunk,
    )
    spine.push(trunk.id)
    if (inFocusedTrunk) focusIds.push(trunk.id)

    topoSort(trunk.branches).forEach((b) => {
      if (b.kind === 'hidden' && !b.revealed) return // 未解放hiddenは内容を一切描画しない(P4で???表示)
      const side: 'left' | 'right' = sideFlip++ % 2 === 0 ? 'right' : 'left'
      const s = side === 'right' ? 1 : -1
      const isSideQuest = b.kind === 'side_quest'
      const branchDx = BRANCH_DX + (isSideQuest ? SIDE_QUEST_EXTRA : 0)
      const leaves = b.leaves ?? []
      const k = b.related.length
      const kl = Math.max(leaves.length, b.leaves_generated ? 0 : 1) // 未生成でも芽1つ分の行高
      const isFocusedBranch = b.id === focusedBranchId
      const branchVisible = !dimAll || isFocusedBranch || (inFocusedTrunk && !focusedBranchId)
      y -= Math.max(ROW_BASE, k * SUB_DY + 40, kl * BUD_DY + 48)

      const jointId = `__j-${b.id}`
      put({ id: jointId, type: 'joint', data: {}, position: { x: 0, y: 0 } }, 0, y, JOINT_SIZE, JOINT_SIZE, dimAll && !(inFocusedTrunk && !focusedBranchId))
      spine.push(jointId)

      const cardCx = s * (branchDx + CARD_W / 2)
      put(
        { id: b.id, type: 'branch', data: { ...b, side, accent, focused: isFocusedBranch }, position: { x: 0, y: 0 }, className: classFor(b.id, isSideQuest ? 'side-quest' : undefined) },
        cardCx, y, CARD_W, CARD_H,
        !branchVisible,
      )
      if (isFocusedBranch) focusIds.push(b.id)
      if (inFocusedTrunk && !focusedBranchId) focusIds.push(b.id)
      edges.push({
        id: `b-${b.id}`,
        source: jointId,
        sourceHandle: side,
        target: b.id,
        targetHandle: 'in',
        animated: b.status === 'in_progress' && view.mode === 'overview',
        style: {
          stroke: isSideQuest ? SIDE_QUEST_COLOR : accent,
          strokeWidth: 3,
          ...(isSideQuest ? { strokeDasharray: '7 5' } : {}),
          ...(dimAll && !branchVisible ? { opacity: 0.05 } : {}),
        },
      })

      // フォーカス時: 葉+関連技術を選択枝の周りに円形配置(引き寄せ)
      const satCount = leaves.length + k
      const radius = 210 + Math.max(0, satCount - 6) * 14
      const angleOf = (i: number) => (-90 + (360 / Math.max(satCount, 1)) * i) * (Math.PI / 180)
      const outerX = s * (branchDx + CARD_W)

      if (leaves.length === 0 && !b.leaves_generated && !isFocusedBranch) {
        // 未生成の枝には芽のプレースホルダーを1つ表示
        const phId = `leaf-${b.id}-__placeholder`
        put({ id: phId, type: 'leaf', data: { id: '__placeholder', branch_id: b.id, label: '', description: '', completion_condition: '', estimated_minutes: 30, status: 'todo', progress: 0, evidence_count: 0, side, mode: 'bud', trunk_id: trunk.id, placeholder: true }, position: { x: 0, y: 0 }, className: 'bud-placeholder' }, outerX + s * (BUD_GAP + BUD_SIZE / 2), y, BUD_SIZE, BUD_SIZE, !branchVisible)
      }

      leaves.forEach((l, j) => {
        const leafId = `leaf-${b.id}-${l.id}`
        const full = isFocusedBranch
        const cx = full ? cardCx + radius * Math.cos(angleOf(j)) : outerX + s * (BUD_GAP + BUD_SIZE / 2)
        const cy = full ? y + radius * Math.sin(angleOf(j)) : y + (j - (leaves.length - 1) / 2) * BUD_DY
        const [w, h] = full ? [LEAF_W, LEAF_H] : [BUD_SIZE, BUD_SIZE]
        put(
          { id: leafId, type: 'leaf', data: { ...l, side, mode: full ? 'full' : 'bud', trunk_id: trunk.id, focused: l.id === focusedLeafId }, position: { x: 0, y: 0 }, className: classFor(l.id) },
          cx, cy, w, h,
          dimAll && !isFocusedBranch && !(inFocusedTrunk && !focusedBranchId),
        )
        if (full) focusIds.push(leafId)
        edges.push(full ? {
          id: `l-${leafId}`,
          source: b.id,
          sourceHandle: 'c',
          target: leafId,
          targetHandle: 'c',
          type: 'straight',
          style: { stroke: LEAF_COLOR, strokeWidth: 2, opacity: 0.9 },
        } : {
          id: `l-${leafId}`,
          source: b.id,
          sourceHandle: 'out',
          target: leafId,
          targetHandle: 'in',
          style: { stroke: LEAF_COLOR, strokeWidth: 1.5, opacity: dimAll && !(inFocusedTrunk && !focusedBranchId) ? 0.05 : 0.55 },
        })
      })

      const subGap = kl > 0 ? BUD_GAP + BUD_SIZE + 42 : SUB_GAP
      b.related.forEach((r, j) => {
        const subId = `sub-${b.id}-${r.id}`
        const full = isFocusedBranch
        const cx = full ? cardCx + radius * Math.cos(angleOf(leaves.length + j)) : outerX + s * (subGap + SUB_W / 2)
        const cy = full ? y + radius * Math.sin(angleOf(leaves.length + j)) : y + (j - (k - 1) / 2) * SUB_DY
        put({ id: subId, type: 'subskill', data: { ...r, side, accent }, position: { x: 0, y: 0 } }, cx, cy, SUB_W, SUB_H, dimAll && !isFocusedBranch && !(inFocusedTrunk && !focusedBranchId))
        if (full) focusIds.push(subId)
        edges.push(full ? {
          id: `r-${subId}`,
          source: b.id,
          sourceHandle: 'c',
          target: subId,
          targetHandle: 'c',
          type: 'straight',
          style: { stroke: accent, strokeWidth: 2, opacity: 0.85 },
        } : {
          id: `r-${subId}`,
          source: b.id,
          sourceHandle: 'out',
          target: subId,
          targetHandle: 'in',
          style: { stroke: accent, strokeWidth: 2, opacity: dimAll && !(inFocusedTrunk && !focusedBranchId) ? 0.05 : 0.5 },
        })
      })
    })
  })

  for (let i = 0; i < spine.length - 1; i++) {
    edges.push({
      id: `t-${i}`,
      source: spine[i],
      sourceHandle: 'top',
      target: spine[i + 1],
      targetHandle: 'bottom',
      type: 'straight',
      style: { stroke: TRUNK_EDGE, strokeWidth: 6, ...(dimAll ? { opacity: view.mode === 'trunk' ? 0.35 : 0.05 } : {}) },
    })
  }
  return { nodes, edges, focusIds }
}
