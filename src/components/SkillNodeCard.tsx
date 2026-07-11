import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { SkillNode } from '../../shared/schemas/tree'

export type SkillCardData = SkillNode & { side: 'left' | 'right'; accent: string }
export type SkillFlowNode = Node<SkillCardData, 'skill'>
export function SkillNodeCard({ data, selected }: NodeProps<SkillFlowNode>) {
  const icon = data.kind === 'hidden' ? '★' : data.status === 'done' ? '✓' : data.status === 'locked' ? '🔒' : '◆'
  return <div className={`skill-node ${data.status} ${data.kind} ${selected?'selected':''}`} style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="source" position={data.side === 'right' ? Position.Right : Position.Left} id="out" />
    <span className="node-icon">{icon}</span><div><small>{data.kind==='hidden'?'HIDDEN SKILL':data.status.replace('_',' ')}</small><strong>{data.label}</strong></div>{data.evidence&&<span className="evidence">証明済み</span>}
  </div>
}
