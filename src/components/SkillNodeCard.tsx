import type { NodeProps, Node } from '@xyflow/react'
import type { SkillNode } from '../../shared/schemas/tree'

export type SkillFlowNode = Node<SkillNode, 'skill'>
export function SkillNodeCard({ data, selected }: NodeProps<SkillFlowNode>) {
  const icon = data.kind === 'hidden' ? '★' : data.status === 'done' ? '✓' : data.status === 'locked' ? '🔒' : '◆'
  return <div className={`skill-node ${data.status} ${data.kind} ${selected?'selected':''}`}><span className="node-icon">{icon}</span><div><small>{data.kind==='hidden'?'HIDDEN SKILL':data.status.replace('_',' ')}</small><strong>{data.label}</strong></div>{data.evidence&&<span className="evidence">証明済み</span>}</div>
}
