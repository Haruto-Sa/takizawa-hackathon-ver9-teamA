import { Handle, Position, type Node } from '@xyflow/react'

export type StartFlowNode = Node<{ goal: string }, 'start'>
export function StartNode() {
  return <div className="start-node"><Handle type="source" position={Position.Top} id="top" /><span>🌱</span><strong>START</strong></div>
}
