import { Handle, Position, type Node } from '@xyflow/react'

export type JointFlowNode = Node<Record<string, never>, 'joint'>
export function JointNode() {
  return <div className="joint-node">
    <Handle type="target" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Top} id="top" />
    <Handle type="source" position={Position.Left} id="left" />
    <Handle type="source" position={Position.Right} id="right" />
  </div>
}
