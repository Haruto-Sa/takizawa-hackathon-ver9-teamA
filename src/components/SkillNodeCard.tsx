import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { SkillNode } from '../../shared/schemas/tree'

const centerHandle: CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }
export type SkillCardData = SkillNode & { side: 'left' | 'right'; accent: string; focused: boolean }
export type SkillFlowNode = Node<SkillCardData, 'skill'>
export function SkillNodeCard({ data, selected }: NodeProps<SkillFlowNode>) {
  const icon = data.kind === 'hidden' ? '★' : data.status === 'done' ? '✓' : data.status === 'locked' ? '🔒' : '◆'
  return <div className={`skill-node ${data.status} ${data.kind} ${data.side} ${selected?'selected':''} ${data.focused?'focused':''}`} style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="source" position={data.side === 'right' ? Position.Right : Position.Left} id="out" />
    <Handle type="source" position={Position.Top} id="c" style={centerHandle} />
    <span className="bubble">{icon}</span>
    <div className="skill-label"><small>{data.kind==='hidden'?'HIDDEN SKILL':data.status.replace('_',' ')}</small><strong>{data.label}</strong>{data.evidence&&<em className="evidence">証明済み</em>}</div>
  </div>
}
