import type { CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { RelatedTech } from '../../shared/schemas/tree'

export type StartFlowNode = Node<{ goal: string }, 'start'>
export function StartNode() {
  return <div className="start-node"><Handle type="source" position={Position.Top} id="top" /><span>🌱</span><strong>START</strong></div>
}

export type TrunkFlowNode = Node<{ label: string; status: string; accent: string }, 'trunk'>
export function TrunkNode({ data }: NodeProps<TrunkFlowNode>) {
  return <div className={`trunk-node ${data.status}`} style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Top} id="top" />
    {data.label}
  </div>
}

export type JointFlowNode = Node<Record<string, never>, 'joint'>
export function JointNode() {
  return <div className="joint-node">
    <Handle type="target" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Top} id="top" />
    <Handle type="source" position={Position.Left} id="left" />
    <Handle type="source" position={Position.Right} id="right" />
  </div>
}

export type SubFlowNode = Node<RelatedTech & { side: 'left' | 'right'; accent: string }, 'subskill'>
export function SubSkillNode({ data }: NodeProps<SubFlowNode>) {
  return <div className="sub-node" style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <strong>{data.label}</strong>
    <small>{data.note}</small>
  </div>
}
