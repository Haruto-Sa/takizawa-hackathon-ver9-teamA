import { useEffect, useState } from 'react'
import { summarizeActivity } from '../lib/api'
import type { ActivitySummary } from '../../shared/schemas/activity'
import type { SkillTreeV2 } from '../../shared/schemas/tree'
import { allBranches } from '../lib/treeSelectors'

export function ReviewModal({ treeId, tree, onClose }: { treeId: string; tree: SkillTreeV2; onClose: () => void }) {
  const branches = allBranches(tree)
  const done = branches.filter((b) => b.status === 'done')
  const working = branches.filter((b) => b.status === 'in_progress' || b.status === 'unlocked')
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [busy, setBusy] = useState(true)
  useEffect(() => { summarizeActivity(treeId, tree).then(setSummary).finally(() => setBusy(false)) }, [treeId]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="modal-backdrop" role="presentation"><div className="modal review" role="dialog" aria-modal="true">
    <button className="close" onClick={onClose} aria-label="閉じる">×</button>
    <p className="eyebrow">REVIEW</p><h2>振り返り</h2>
    <div className="summary-block">
      <span className="block-title">AIによる自動整理</span>
      {busy ? <div className="loader">AIが取り組みを整理しています…</div> : summary && <>
        <p className="summary-text">{summary.summary}</p>
        {summary.highlights.length > 0 && <div className="chips">{summary.highlights.map(h => <span key={h}>✓ {h}</span>)}</div>}
        {summary.next_steps.length > 0 && <><span className="block-title">次の一歩</span><ul>{summary.next_steps.map(s => <li key={s}>{s}</li>)}</ul></>}
      </>}
    </div>
    <div className="history-block">
      <span className="block-title">挑戦の履歴</span>
      {done.length === 0 && <p className="muted">まだ習得済みのスキルはありません。クイズに挑戦してみよう！</p>}
      {done.map(b => {
        const ev = b.evidence.find((e) => e.type === 'quiz') ?? b.evidence[0]
        return <div className="history-row" key={b.id}><strong>✓ {b.label}</strong><small>{ev ? ev.created_at.slice(0, 10) : ''}{typeof ev?.score === 'number' ? ` ・ スコア ${Math.round(ev.score * 100)}%` : ''}</small></div>
      })}
      {working.length > 0 && <div className="history-row now"><strong>◆ 取り組み中</strong><small>{working.map(b => b.label).join(' / ')}</small></div>}
    </div>
  </div></div>
}
