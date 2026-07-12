import type { Branch, LeafV2, SkillTreeV2, Trunk } from '../../shared/schemas/tree'

export function findTrunk(tree: SkillTreeV2, trunkId: string): Trunk | undefined {
  return tree.trunks.find((t) => t.id === trunkId)
}

export function findBranch(tree: SkillTreeV2, branchId: string): Branch | undefined {
  for (const t of tree.trunks) {
    const b = t.branches.find((x) => x.id === branchId)
    if (b) return b
  }
  return undefined
}

export function trunkOf(tree: SkillTreeV2, branchId: string): Trunk | undefined {
  return tree.trunks.find((t) => t.branches.some((b) => b.id === branchId))
}

export function findLeaf(tree: SkillTreeV2, branchId: string, leafId: string): LeafV2 | undefined {
  return findBranch(tree, branchId)?.leaves?.find((l) => l.id === leafId)
}

export function allBranches(tree: SkillTreeV2): Branch[] {
  return tree.trunks.flatMap((t) => t.branches)
}

export function currentTrunk(tree: SkillTreeV2): Trunk | undefined {
  return tree.trunks.find((t) => t.status === 'current')
}

// 総合達成率: core枝のみ対象(side_quest/hiddenはメイン進捗に含めない)
export function overallProgress(tree: SkillTreeV2): number {
  const core = allBranches(tree).filter((b) => b.kind === 'core')
  if (core.length === 0) return 0
  return Math.round(core.reduce((sum, b) => sum + b.progress, 0) / core.length)
}

// prerequisite_ids の循環を検出。循環に含まれるノードid配列のリストを返す(空なら健全)。
export function detectPrerequisiteCycles(tree: SkillTreeV2): string[][] {
  const branches = allBranches(tree)
  const byId = new Map(branches.map((b) => [b.id, b]))
  const state = new Map<string, 'visiting' | 'done'>()
  const cycles: string[][] = []
  const stack: string[] = []
  const visit = (id: string) => {
    const mark = state.get(id)
    if (mark === 'done') return
    if (mark === 'visiting') {
      const start = stack.indexOf(id)
      cycles.push(stack.slice(start))
      return
    }
    state.set(id, 'visiting')
    stack.push(id)
    byId.get(id)?.prerequisite_ids.forEach((p) => {
      if (byId.has(p)) visit(p)
    })
    stack.pop()
    state.set(id, 'done')
  }
  branches.forEach((b) => visit(b.id))
  return cycles
}
