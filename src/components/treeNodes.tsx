import type { CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Leaf, RelatedTech } from '../../shared/schemas/tree'

const centerHandle: CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }

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

// mode: 全体ビューでは芽(bud=小ドット)、フォーカス時はラベル付きピル(full)
export type LeafFlowNode = Node<Leaf & { side: 'left' | 'right'; mode: 'bud' | 'full' }, 'leaf'>
export function LeafNode({ data }: NodeProps<LeafFlowNode>) {
  return <div className={`leaf-node ${data.status} ${data.mode}`}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="target" position={Position.Top} id="c" style={centerHandle} />
    {data.mode === 'full' && <><span>🍃</span><strong>{data.label}</strong></>}
  </div>
}

export type SubFlowNode = Node<RelatedTech & { side: 'left' | 'right'; accent: string }, 'subskill'>
export function SubSkillNode({ data }: NodeProps<SubFlowNode>) {
  return <div className="sub-node" style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="target" position={Position.Top} id="c" style={centerHandle} />
    <strong>{data.label}</strong>
    <small>{data.note}</small>
  </div>
}
