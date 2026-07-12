import type { SkillTreeV2 } from '../../shared/schemas/tree'
import type { ArtifactAnalysis, ArtifactMatch } from '../../shared/schemas/artifact'

// AI分類の候補ノード抽出と、ローカル簡易分類器(唯一の正)。
// バックエンド実装時に supabase/functions/_shared/candidates.ts へミラーする。

export type CandidateNode = {
  trunk_id: string
  branch_id: string
  leaf_id?: string
  label: string
  description: string
  status: string
  kind: string
}

// 日本語(空白区切りなし)にも効くよう、ASCII語 + CJK 2-gram でトークン化する
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

// 優先順: フォーカス中の枝とその葉 → in_progress/unlocked の枝 → キーワード一致順。
// 未解放hiddenは候補に含めない(内容を漏らさない)。最大 max 件。
export function buildCandidates(tree: SkillTreeV2, opts?: { focusedBranchId?: string; inputText?: string; max?: number }): CandidateNode[] {
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
    const leaves = (b.leaves ?? []).map((l): CandidateNode => ({ trunk_id: trunkId, branch_id: b.id, leaf_id: l.id, label: l.label, description: l.description, status: l.status, kind: b.kind }))
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

// ローカル簡易分類器(AI障害時・デモ・バックエンド未接続時のフォールバック)。
// キーワード一致数から確信度を見積もる。新しいノードは決して作らない。
export function classifyArtifactLocally(tree: SkillTreeV2, input: { text: string; focusedBranchId?: string }): ArtifactAnalysis {
  const tokens = tokenize(input.text)
  const candidates = buildCandidates(tree, { focusedBranchId: input.focusedBranchId, inputText: input.text, max: 30 })
  const scored = candidates
    .map((c) => ({ c, hits: scoreCandidate(tokens, c) + (c.branch_id === input.focusedBranchId ? 1 : 0) }))
    .filter((s) => s.hits >= 1)
    .sort((a, b) => b.hits - a.hits)

  // 枝ごとに最良1件(葉一致を優先)
  const byBranch = new Map<string, { c: CandidateNode; hits: number }>()
  for (const s of scored) {
    const prev = byBranch.get(s.c.branch_id)
    if (!prev || s.hits > prev.hits || (s.hits === prev.hits && s.c.leaf_id && !prev.c.leaf_id)) byBranch.set(s.c.branch_id, s)
  }
  const matches: ArtifactMatch[] = [...byBranch.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .filter((s) => s.c.status !== 'locked')
    .map((s) => ({
      trunk_id: s.c.trunk_id,
      branch_id: s.c.branch_id,
      ...(s.c.leaf_id ? { leaf_id: s.c.leaf_id } : {}),
      confidence: Math.min(0.95, 0.45 + s.hits * 0.13),
      progress_delta: Math.min(30, 6 + s.hits * 4),
      completion_supported: false,
      reason: `入力内容が「${s.c.label}」のキーワードと${s.hits}箇所一致しました（ローカル簡易判定）`,
      tags: [],
    }))
  return {
    summary: matches.length > 0
      ? `投稿内容から ${matches.length} 件のスキルとの関連を検出しました。`
      : '既存のスキルツリーと明確に関連づけられませんでした。未分類の記録として保存します。',
    matches,
    hidden_signals: [],
    warnings: [],
  }
}
