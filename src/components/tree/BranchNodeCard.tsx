import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { Branch } from '../../../shared/schemas/tree'
import { centerHandle } from './handles'

export type BranchCardData = Branch & { side: 'left' | 'right'; accent: string; focused: boolean }
export type BranchFlowNode = Node<BranchCardData, 'branch'>
export function BranchNodeCard({ data, selected }: NodeProps<BranchFlowNode>) {
  const icon = data.kind === 'hidden' ? '★' : data.status === 'done' ? '✓' : data.status === 'locked' ? '🔒' : '◆'
  return <div className={`skill-node ${data.status} ${data.kind} ${data.side} ${selected?'selected':''} ${data.focused?'focused':''}`} style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="source" position={data.side === 'right' ? Position.Right : Position.Left} id="out" />
    <Handle type="source" position={Position.Top} id="c" style={centerHandle} />
    <span className="bubble">{icon}</span>
    <div className="skill-label"><small>{data.kind==='hidden'?'HIDDEN SKILL':data.kind==='side_quest'?'SIDE QUEST':data.status.replace('_',' ')}</small><strong>{data.label}</strong>{data.evidence.length>0&&<em className="evidence">証明 {data.evidence.length}件</em>}</div>
  </div>
}
