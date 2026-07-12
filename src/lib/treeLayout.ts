import type { Edge } from '@xyflow/react'
import type { SkillNode, SkillTree } from '../../shared/schemas/tree'
import type { SkillFlowNode } from '../components/SkillNodeCard'
import type { JointFlowNode, LeafFlowNode, StartFlowNode, SubFlowNode, TrunkFlowNode } from '../components/treeNodes'

export type TreeFlowNode = SkillFlowNode | StartFlowNode | TrunkFlowNode | JointFlowNode | SubFlowNode | LeafFlowNode

// マイルストーンごとに循環するネオンアクセント
export const ACCENTS = ['#67e8f9', '#f0abfc', '#6ee7b7', '#fcd34d', '#a5b4fc', '#5eead4']

const CARD_W = 220
const CARD_H = 66
const TRUNK_W = 190
const TRUNK_H = 46
const START_SIZE = 104
const JOINT_SIZE = 8
const SUB_W = 160
const SUB_H = 52
// 全体ビューでは葉は小さな芽(ドット)として表示し、重なりを防ぐ
const BUD_SIZE = 14
const BUD_GAP = 18
const BUD_DY = 20
// フォーカスビューの葉ピル
const LEAF_W = 150
const LEAF_H = 40
const BRANCH_DX = 90 // 幹からカード内側エッジまで
const SUB_GAP = 56 // カード外側エッジからサブピルまで(芽がある場合は芽の外側)
const SUB_DY = 62
const ROW_BASE = 112
const TRUNK_ROW = 104
const START_ROW = 136
const LEAF_COLOR = '#4ade80'
const TRUNK_EDGE = '#3b5a72'
const FOCUS_DIM = { opacity: 0.07, pointerEvents: 'none' as const }

// 前提スキルが幹の下側に来るよう並べ替え
function topoSort(nodes: SkillNode[]): SkillNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const out: SkillNode[] = []
  const visit = (n: SkillNode) => {
    if (visited.has(n.id)) return
    visited.add(n.id)
    n.prerequisite_ids.forEach(id => {
      const p = byId.get(id)
      if (p) visit(p)
    })
    out.push(n)
  }
  nodes.forEach(visit)
  return out
}

// focusId を指定すると、そのスキルを中心に葉・関連技術を円形に引き寄せ、他をフェードする
export function buildFlow(tree: SkillTree, focusId?: string | null): { nodes: TreeFlowNode[]; edges: Edge[]; focusIds: string[] } {
  const nodes: TreeFlowNode[] = []
  const edges: Edge[] = []
  const spine: string[] = [] // 幹上のノードid(下から上)
  const focusIds: string[] = []
  let y = 0
  let sideFlip = 0

  const put = (node: TreeFlowNode, cx: number, cy: number, w: number, h: number, dimmed: boolean) => {
    node.position = { x: cx - w / 2, y: cy - h / 2 }
    if (dimmed) node.style = FOCUS_DIM
    nodes.push(node)
  }

  put({ id: '__start', type: 'start', data: { goal: tree.goal }, position: { x: 0, y: 0 } }, 0, y, START_SIZE, START_SIZE, !!focusId)
  spine.push('__start')

  tree.milestones.forEach((m, mi) => {
    const accent = ACCENTS[mi % ACCENTS.length]
    y -= spine.length === 1 ? START_ROW : TRUNK_ROW
    put({ id: m.id, type: 'trunk', data: { label: m.label, status: m.status, accent }, position: { x: 0, y: 0 } }, 0, y, TRUNK_W, TRUNK_H, !!focusId)
    spine.push(m.id)

    topoSort(m.nodes).forEach(n => {
      const side: 'left' | 'right' = sideFlip++ % 2 === 0 ? 'right' : 'left'
      const s = side === 'right' ? 1 : -1
      const k = n.related.length
      const kl = n.leaves.length
      const isFocus = n.id === focusId
      y -= Math.max(ROW_BASE, k * SUB_DY + 40, kl * BUD_DY + 48)

      const jointId = `__j-${n.id}`
      put({ id: jointId, type: 'joint', data: {}, position: { x: 0, y: 0 } }, 0, y, JOINT_SIZE, JOINT_SIZE, !!focusId)
      spine.push(jointId)

      const cardCx = s * (BRANCH_DX + CARD_W / 2)
      put({ id: n.id, type: 'skill', data: { ...n, side, accent, focused: isFocus }, position: { x: 0, y: 0 } }, cardCx, y, CARD_W, CARD_H, !!focusId && !isFocus)
      edges.push({
        id: `b-${n.id}`,
        source: jointId,
        sourceHandle: side,
        target: n.id,
        targetHandle: 'in',
        animated: n.status === 'in_progress' && !focusId,
        style: { stroke: accent, strokeWidth: 3, ...(focusId ? { opacity: 0.05 } : {}) },
      })

      // フォーカス時: 葉+関連技術を選択ノードの周りに円形配置(引き寄せ)
      const satCount = kl + k
      const radius = 210 + Math.max(0, satCount - 6) * 14
      const angleOf = (i: number) => (-90 + (360 / Math.max(satCount, 1)) * i) * (Math.PI / 180)
      const outerX = s * (BRANCH_DX + CARD_W)

      n.leaves.forEach((l, j) => {
        const leafId = `leaf-${n.id}-${l.id}`
        const cx = isFocus ? cardCx + radius * Math.cos(angleOf(j)) : outerX + s * (BUD_GAP + BUD_SIZE / 2)
        const cy = isFocus ? y + radius * Math.sin(angleOf(j)) : y + (j - (kl - 1) / 2) * BUD_DY
        const [w, h] = isFocus ? [LEAF_W, LEAF_H] : [BUD_SIZE, BUD_SIZE]
        put({ id: leafId, type: 'leaf', data: { ...l, side, mode: isFocus ? 'full' : 'bud' }, position: { x: 0, y: 0 } }, cx, cy, w, h, !!focusId && !isFocus)
        if (isFocus) focusIds.push(leafId)
        edges.push(isFocus ? {
          id: `l-${leafId}`,
          source: n.id,
          sourceHandle: 'c',
          target: leafId,
          targetHandle: 'c',
          type: 'straight',
          style: { stroke: LEAF_COLOR, strokeWidth: 2, opacity: 0.9 },
        } : {
          id: `l-${leafId}`,
          source: n.id,
          sourceHandle: 'out',
          target: leafId,
          targetHandle: 'in',
          style: { stroke: LEAF_COLOR, strokeWidth: 1.5, opacity: focusId ? 0.05 : 0.55 },
        })
      })

      const subGap = kl > 0 ? BUD_GAP + BUD_SIZE + 42 : SUB_GAP
      n.related.forEach((r, j) => {
        const subId = `sub-${n.id}-${r.id}`
        const cx = isFocus ? cardCx + radius * Math.cos(angleOf(kl + j)) : outerX + s * (subGap + SUB_W / 2)
        const cy = isFocus ? y + radius * Math.sin(angleOf(kl + j)) : y + (j - (k - 1) / 2) * SUB_DY
        put({ id: subId, type: 'subskill', data: { ...r, side, accent }, position: { x: 0, y: 0 } }, cx, cy, SUB_W, SUB_H, !!focusId && !isFocus)
        if (isFocus) focusIds.push(subId)
        edges.push(isFocus ? {
          id: `r-${subId}`,
          source: n.id,
          sourceHandle: 'c',
          target: subId,
          targetHandle: 'c',
          type: 'straight',
          style: { stroke: accent, strokeWidth: 2, opacity: 0.85 },
        } : {
          id: `r-${subId}`,
          source: n.id,
          sourceHandle: 'out',
          target: subId,
          targetHandle: 'in',
          style: { stroke: accent, strokeWidth: 2, opacity: focusId ? 0.05 : 0.5 },
        })
      })
      if (isFocus) focusIds.unshift(n.id)
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
      style: { stroke: TRUNK_EDGE, strokeWidth: 6, ...(focusId ? { opacity: 0.05 } : {}) },
    })
  }
  return { nodes, edges, focusIds }
}
