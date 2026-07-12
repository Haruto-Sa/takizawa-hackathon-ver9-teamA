import type { CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { RelatedTech } from '../../../shared/schemas/tree'
import { centerHandle } from './handles'

export type SubFlowNode = Node<RelatedTech & { side: 'left' | 'right'; accent: string }, 'subskill'>
export function SubSkillNode({ data }: NodeProps<SubFlowNode>) {
  return <div className="sub-node" style={{ '--accent': data.accent } as CSSProperties}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="target" position={Position.Top} id="c" style={centerHandle} />
    <strong>{data.label}</strong>
    <small>{data.note}</small>
  </div>
}
