import type { Branch, LeafV2 } from '../../../shared/schemas/tree'
import { DailyLogForm, type DailyLogFormInput } from './DailyLogForm'

const statusLabel: Record<string, string> = { todo: 'これから', doing: '取り組み中', done: '完了', skipped: 'スキップ' }

export function LeafDetailPanel({ leaf, branch, onDailyLog, onClose }: {
  leaf: LeafV2
  branch: Branch
  onDailyLog: (input: DailyLogFormInput) => Promise<void> | void
  onClose: () => void
}) {
  return <>
    <button className="close" onClick={onClose} aria-label="閉じる">×</button>
    <span className="detail-icon leaf">🍃</span>
    <p className="eyebrow">LEAF ・ {branch.label}</p>
    <h2>{leaf.label}</h2>
    {leaf.description && <p>{leaf.description}</p>}
    {leaf.completion_condition && <div className="leaf-list"><span>完了条件</span><div><small>{leaf.completion_condition}</small></div></div>}
    <div className="progress-bar"><i style={{ width: `${leaf.progress}%` }} /></div>
    <p className="progress-label">進捗 {leaf.progress}% ・ 目安 {leaf.estimated_minutes}分 ・ {statusLabel[leaf.status] ?? leaf.status}</p>
    <DailyLogForm leaf={leaf} onSubmit={onDailyLog} />
  </>
}
