import type { LeafV2, SkillTreeV2 } from './tree-schema.ts'

// src/lib/candidateCore.ts のミラー(候補抽出部分)。変更時は同期すること。
export type CandidateNode = {
  trunk_id: string
  branch_id: string
  leaf_id?: string
  label: string
  description: string
  status: string
  kind: string
}

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  const lower = text.toLowerCase()
  for (const m of lower.matchAll(/[a-z0-9_+#.-]{2,}/g)) tokens.add(m[0])
  const cjk = lower.replace(/[^぀-ヿ一-鿿]/g, ' ')
  for (const run of cjk.split(/\s+/)) {
    if (run.length < 2) continue
    for (let i = 0; i < run.length - 1; i++) tokens.add(run.slice(i, i + 2))
  }
  return tokens
}

export function scoreCandidate(inputTokens: Set<string>, candidate: CandidateNode): number {
  const target = tokenize(`${candidate.label} ${candidate.description}`)
  let hits = 0
  for (const t of target) if (inputTokens.has(t)) hits++
  return hits
}

export function buildCandidates(tree: SkillTreeV2, leavesByBranch: Map<string, LeafV2[]>, opts?: { focusedBranchId?: string; inputText?: string; max?: number }): CandidateNode[] {
  const max = opts?.max ?? 30
  const inputTokens = opts?.inputText ? tokenize(opts.inputText) : new Set<string>()
  const out: CandidateNode[] = []
  const seen = new Set<string>()
  const push = (c: CandidateNode) => {
    const key = c.leaf_id ? `${c.branch_id}/${c.leaf_id}` : c.branch_id
    if (seen.has(key) || out.length >= max) return
    seen.add(key)
    out.push(c)
  }
  const branchCandidates = (trunkId: string, b: SkillTreeV2['trunks'][number]['branches'][number]): CandidateNode[] => {
    const base: CandidateNode = { trunk_id: trunkId, branch_id: b.id, label: b.label, description: b.description, status: b.status, kind: b.kind }
    const leaves = (leavesByBranch.get(b.id) ?? []).map((l): CandidateNode => ({ trunk_id: trunkId, branch_id: b.id, leaf_id: l.id, label: l.label, description: l.description, status: l.status, kind: b.kind }))
    return [base, ...leaves]
  }
  const all = tree.trunks.flatMap((t) => t.branches.filter((b) => b.revealed).map((b) => ({ trunkId: t.id, branch: b })))
  const focused = all.find((x) => x.branch.id === opts?.focusedBranchId)
  if (focused) branchCandidates(focused.trunkId, focused.branch).forEach(push)
  all.filter((x) => x.branch.status === 'in_progress' || x.branch.status === 'unlocked')
    .forEach((x) => branchCandidates(x.trunkId, x.branch).forEach(push))
  if (inputTokens.size > 0) {
    all.map((x) => ({ x, score: scoreCandidate(inputTokens, { trunk_id: x.trunkId, branch_id: x.branch.id, label: x.branch.label, description: x.branch.description, status: x.branch.status, kind: x.branch.kind }) }))
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score > 0)
      .forEach((s) => branchCandidates(s.x.trunkId, s.x.branch).forEach(push))
  }
  all.forEach((x) => push({ trunk_id: x.trunkId, branch_id: x.branch.id, label: x.branch.label, description: x.branch.description, status: x.branch.status, kind: x.branch.kind }))
  return out.slice(0, max)
}
