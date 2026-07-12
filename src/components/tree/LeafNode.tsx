import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { LeafV2 } from '../../../shared/schemas/tree'
import { centerHandle } from './handles'

// mode: 全体/木ビューでは芽(bud=小ドット)、枝フォーカス時はラベル付きピル(full)
export type LeafFlowNode = Node<LeafV2 & { side: 'left' | 'right'; mode: 'bud' | 'full'; trunk_id: string; focused?: boolean; placeholder?: boolean }, 'leaf'>
export function LeafNode({ data }: NodeProps<LeafFlowNode>) {
  return <div className={`leaf-node ${data.status} ${data.mode} ${data.focused ? 'focused' : ''}`}>
    <Handle type="target" position={data.side === 'right' ? Position.Left : Position.Right} id="in" />
    <Handle type="target" position={Position.Top} id="c" style={centerHandle} />
    {data.mode === 'full' && <><span>🍃</span><strong>{data.label}</strong></>}
  </div>
}
