import type { Edge } from '@xyflow/react'
import type { SkillNode, SkillTree } from '../../shared/schemas/tree'
import type { SkillFlowNode } from '../components/SkillNodeCard'
import type { JointFlowNode, StartFlowNode, SubFlowNode, TrunkFlowNode } from '../components/treeNodes'

export type TreeFlowNode = SkillFlowNode | StartFlowNode | TrunkFlowNode | JointFlowNode | SubFlowNode

// マイルストーンごとに循環するパステルアクセント
export const ACCENTS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#2dd4bf']

const CARD_W = 220
const CARD_H = 78
const TRUNK_W = 190
const TRUNK_H = 46
const START_SIZE = 104
const JOINT_SIZE = 8
const SUB_W = 160
const SUB_H = 52
const BRANCH_DX = 90 // 幹からカード内側エッジまで
const SUB_GAP = 56 // カード外側エッジからサブピルまで
const SUB_DY = 62
const ROW_BASE = 112
const TRUNK_ROW = 104
const START_ROW = 136

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

export function buildFlow(tree: SkillTree): { nodes: TreeFlowNode[]; edges: Edge[] } {
  const nodes: TreeFlowNode[] = []
  const edges: Edge[] = []
  const spine: string[] = [] // 幹上のノードid(下から上)
  let y = 0
  let sideFlip = 0

  const put = (node: TreeFlowNode, cx: number, cy: number, w: number, h: number) => {
    node.position = { x: cx - w / 2, y: cy - h / 2 }
    nodes.push(node)
  }

  put({ id: '__start', type: 'start', data: { goal: tree.goal }, position: { x: 0, y: 0 } }, 0, y, START_SIZE, START_SIZE)
  spine.push('__start')

  tree.milestones.forEach((m, mi) => {
    const accent = ACCENTS[mi % ACCENTS.length]
    y -= spine.length === 1 ? START_ROW : TRUNK_ROW
    put({ id: m.id, type: 'trunk', data: { label: m.label, status: m.status, accent }, position: { x: 0, y: 0 } }, 0, y, TRUNK_W, TRUNK_H)
    spine.push(m.id)

    topoSort(m.nodes).forEach(n => {
      const side: 'left' | 'right' = sideFlip++ % 2 === 0 ? 'right' : 'left'
      const s = side === 'right' ? 1 : -1
      const k = n.related.length
      y -= Math.max(ROW_BASE, k * SUB_DY + 40)

      const jointId = `__j-${n.id}`
      put({ id: jointId, type: 'joint', data: {}, position: { x: 0, y: 0 } }, 0, y, JOINT_SIZE, JOINT_SIZE)
      spine.push(jointId)

      put({ id: n.id, type: 'skill', data: { ...n, side, accent }, position: { x: 0, y: 0 } }, s * (BRANCH_DX + CARD_W / 2), y, CARD_W, CARD_H)
      edges.push({
        id: `b-${n.id}`,
        source: jointId,
        sourceHandle: side,
        target: n.id,
        targetHandle: 'in',
        animated: n.status === 'in_progress',
        style: { stroke: accent, strokeWidth: 3 },
      })

      const outerX = s * (BRANCH_DX + CARD_W)
      n.related.forEach((r, j) => {
        const subId = `sub-${n.id}-${r.id}`
        put({ id: subId, type: 'subskill', data: { ...r, side, accent }, position: { x: 0, y: 0 } }, outerX + s * (SUB_GAP + SUB_W / 2), y + (j - (k - 1) / 2) * SUB_DY, SUB_W, SUB_H)
        edges.push({
          id: `r-${subId}`,
          source: n.id,
          sourceHandle: 'out',
          target: subId,
          targetHandle: 'in',
          style: { stroke: accent, strokeWidth: 2, opacity: 0.55 },
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
      style: { stroke: '#c8d3dc', strokeWidth: 6 },
    })
  }
  return { nodes, edges }
}
