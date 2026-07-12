import type { Trunk } from '../../../shared/schemas/tree'

const statusLabel: Record<string, string> = { completed: '達成済み', current: 'いまここ', upcoming: 'この先', locked: 'ロック中' }

export function TrunkDetailPanel({ trunk, onFocusBranch, onClose }: { trunk: Trunk; onFocusBranch: (branchId: string) => void; onClose: () => void }) {
  return <>
    <button className="close" onClick={onClose} aria-label="閉じる">×</button>
    <span className="detail-icon">🌳</span>
    <p className="eyebrow">TRUNK ・ {statusLabel[trunk.status] ?? trunk.status}</p>
    <h2>{trunk.label}</h2>
    {trunk.description && <p>{trunk.description}</p>}
    <div className="progress-bar"><i style={{ width: `${trunk.progress}%` }} /></div>
    <p className="progress-label">進捗 {trunk.progress}%</p>
    <div className="branch-list">
      <span>この木の枝（学習単元）</span>
      {trunk.branches.filter((b) => b.revealed).map((b) => (
        <button key={b.id} className={`branch-row ${b.status}`} onClick={() => onFocusBranch(b.id)}>
          <strong>{b.status === 'done' ? '✓' : b.status === 'locked' ? '🔒' : '◆'} {b.label}</strong>
          <small>{b.kind === 'side_quest' ? 'SIDE QUEST' : `約${b.estimated_days}日`} ・ {b.progress}%</small>
        </button>
      ))}
    </div>
  </>
}
