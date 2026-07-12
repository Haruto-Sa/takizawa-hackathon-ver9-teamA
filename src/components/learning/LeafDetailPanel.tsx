import type { Branch, LeafV2 } from '../../../shared/schemas/tree'

const statusLabel: Record<string, string> = { todo: 'これから', doing: '取り組み中', done: '完了', skipped: 'スキップ' }

export function LeafDetailPanel({ leaf, branch, onClose }: { leaf: LeafV2; branch: Branch; onClose: () => void }) {
  return <>
    <button className="close" onClick={onClose} aria-label="閉じる">×</button>
    <span className="detail-icon leaf">🍃</span>
    <p className="eyebrow">LEAF ・ {branch.label}</p>
    <h2>{leaf.label}</h2>
    {leaf.description && <p>{leaf.description}</p>}
    {leaf.completion_condition && <div className="leaf-list"><span>完了条件</span><div><small>{leaf.completion_condition}</small></div></div>}
    <div className="status-line"><span>目安</span><strong>{leaf.estimated_minutes}分</strong></div>
    <div className="status-line"><span>STATUS</span><strong>{statusLabel[leaf.status] ?? leaf.status} ・ {leaf.progress}%</strong></div>
  </>
}
