import type { CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { TrunkStatus } from '../../../shared/schemas/tree'

export type TrunkFlowNode = Node<{ label: string; status: TrunkStatus; accent: string; progress: number }, 'trunk'>
export function TrunkNode({ data }: NodeProps<TrunkFlowNode>) {
  return <div className={`trunk-node ${data.status}`} style={{ '--accent': data.accent } as CSSProperties} title={`進捗 ${data.progress}%`}>
    <Handle type="target" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Top} id="top" />
    {data.label}
  </div>
}
