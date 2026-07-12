import type { Branch } from '../../../shared/schemas/tree'

export function BranchDetailPanel({ branch, loadingLeaves, onChallenge, onFocusLeaf, onClose }: {
  branch: Branch
  loadingLeaves?: boolean
  onChallenge: () => void
  onFocusLeaf: (leafId: string) => void
  onClose: () => void
}) {
  const icon = branch.kind === 'hidden' ? '★' : branch.status === 'done' ? '✓' : '◆'
  const quizEvidence = branch.evidence.find((e) => e.type === 'quiz')
  return <>
    <button className="close" onClick={onClose} aria-label="閉じる">×</button>
    <span className={`detail-icon ${branch.kind === 'hidden' ? 'hidden' : ''}`}>{icon}</span>
    <p className="eyebrow">{branch.kind === 'hidden' ? 'HIDDEN SKILL' : branch.kind === 'side_quest' ? 'SIDE QUEST' : 'BRANCH'}</p>
    <h2>{branch.label}</h2>
    <p>{branch.description}</p>
    <div className="progress-bar"><i style={{ width: `${branch.progress}%` }} /></div>
    <p className="progress-label">進捗 {branch.progress}% ・ 目安 約{branch.estimated_days}日</p>
    {loadingLeaves && <div className="loader">葉（今日の行動）を用意しています…</div>}
    {(branch.leaves?.length ?? 0) > 0 && <div className="leaf-list"><span>学習ステップ（葉）</span>
      {branch.leaves!.map((l) => (
        <button key={l.id} className="leaf-row" onClick={() => onFocusLeaf(l.id)}>
          <strong>{l.status === 'done' ? '✅' : '🍃'} {l.label}</strong>
          <small>{l.description}</small>
        </button>
      ))}
    </div>}
    {branch.related.length > 0 && <div className="related-list"><span>関連技術</span>
      {branch.related.map((r) => <div key={r.id}><strong>{r.label}</strong><small>{r.note}</small></div>)}
    </div>}
    <div className="status-line"><span>STATUS</span><strong>{branch.status}</strong></div>
    {branch.status === 'done'
      ? <div className="verified">✓ クイズで証明済み{quizEvidence ? ` ・ ${quizEvidence.created_at.slice(0, 10)}` : ''}</div>
      : branch.status === 'locked'
        ? <button className="primary wide" disabled>前のスキルを完了しよう</button>
        : <button className="primary wide" onClick={onChallenge}>このスキルに挑戦する →</button>}
  </>
}
