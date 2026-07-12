import { useEffect, useMemo, useState } from 'react'
import { Controls, ReactFlow, type NodeMouseHandler, type ReactFlowInstance } from '@xyflow/react'
import { AnimatePresence, motion } from 'motion/react'
import type { SkillTreeV2 } from '../../shared/schemas/tree'
import type { GradeResponse } from '../../shared/schemas/quiz'
import { BranchNodeCard } from '../components/tree/BranchNodeCard'
import { JointNode, LeafNode, StartNode, SubSkillNode, TrunkNode } from '../components/tree/nodes'
import { TreeBreadcrumbs } from '../components/tree/TreeBreadcrumbs'
import { TrunkDetailPanel } from '../components/tree/TrunkDetailPanel'
import { BranchDetailPanel } from '../components/tree/BranchDetailPanel'
import { LeafDetailPanel } from '../components/learning/LeafDetailPanel'
import { ArtifactInputPanel } from '../components/learning/ArtifactInputPanel'
import type { DailyLogFormInput } from '../components/learning/DailyLogForm'
import { QuizModal } from '../components/QuizModal'
import { ReviewModal } from '../components/ReviewModal'
import { TreeMark } from '../components/TreeMark'
import { buildFlow, type TreeFlowNode } from '../lib/treeLayout'
import { normalizeTree } from '../lib/treeAdapter'
import { computeLeafUpdate, recalcTree } from '../lib/progressCore'
import { currentTrunk, findBranch, findLeaf, findTrunk, overallProgress } from '../lib/treeSelectors'
import { useTreeNavigation } from '../hooks/useTreeNavigation'
import { useGrowthFlash } from '../hooks/useGrowthFlash'

const nodeTypes = { branch: BranchNodeCard, trunk: TrunkNode, start: StartNode, joint: JointNode, subskill: SubSkillNode, leaf: LeafNode }
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SkillTreePage({ treeId, initialTree, onReset }: { treeId: string; initialTree: SkillTreeV2; onReset: () => void }) {
  const [tree, setTree] = useState(initialTree)
  const [quiz, setQuiz] = useState(false)
  const [review, setReview] = useState(false)
  const [post, setPost] = useState(false)
  const [rf, setRf] = useState<ReactFlowInstance<TreeFlowNode> | null>(null)
  const { view, setView, focusTrunk, focusBranch, focusLeaf, back, breadcrumbs } = useTreeNavigation(tree)
  const { recentlyUpdatedIds, flash } = useGrowthFlash()
  const flow = useMemo(() => buildFlow(tree, view, { recentlyUpdatedIds }), [tree, view, recentlyUpdatedIds])
  const rate = overallProgress(tree)
  const trunk = view.mode !== 'overview' ? findTrunk(tree, view.trunkId) : undefined
  const branch = view.mode === 'branch' || view.mode === 'leaf' ? findBranch(tree, view.branchId) : undefined
  const leaf = view.mode === 'leaf' ? findLeaf(tree, view.branchId, view.leafId) : undefined
  const heading = view.mode === 'overview' ? (currentTrunk(tree)?.label ?? 'スキルマップ') : (trunk?.label ?? 'スキルマップ')

  useEffect(() => {
    if (!rf) return
    const duration = prefersReducedMotion() ? 0 : 750
    const t = setTimeout(() => {
      if (view.mode === 'overview' || flow.focusIds.length === 0) rf.fitView({ duration, padding: 0.15 })
      else rf.fitView({ nodes: flow.focusIds.map((id) => ({ id })), duration, padding: view.mode === 'trunk' ? 0.2 : 0.4 })
    }, 40)
    return () => clearTimeout(t)
  }, [rf, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeClick: NodeMouseHandler<TreeFlowNode> = (_, node) => {
    switch (node.type) {
      case 'trunk':
        focusTrunk(node.id)
        break
      case 'branch':
        focusBranch(node.data.trunk_id, node.id)
        break
      case 'leaf': {
        const d = node.data
        if (d.placeholder || d.mode === 'bud') focusBranch(d.trunk_id, d.branch_id)
        else focusLeaf(d.trunk_id, d.branch_id, d.id)
        break
      }
    }
  }

  const handleQuizPassed = (result: GradeResponse) => {
    if (result.tree) {
      setTree(normalizeTree(result.tree, { id: treeId }))
      flash(result.updated_node_ids ?? (branch ? [branch.id] : []))
    }
  }

  // 日次記録。TODO(backend): record-daily-log Edge Function 接続(現状はフロント先行のローカル反映)
  const handleDailyLog = async (input: DailyLogFormInput) => {
    if (!branch || !leaf) return
    const updatedLeaf = computeLeafUpdate(leaf, { studied_minutes: input.studiedMinutes, completed: input.completed })
    const withLeaf: SkillTreeV2 = {
      ...tree,
      trunks: tree.trunks.map((t) => ({
        ...t,
        branches: t.branches.map((b) => b.id === branch.id
          ? { ...b, leaves: (b.leaves ?? []).map((l) => (l.id === leaf.id ? updatedLeaf : l)) }
          : b),
      })),
    }
    const branchLeaves = withLeaf.trunks.flatMap((t) => t.branches).find((b) => b.id === branch.id)?.leaves ?? []
    const { tree: next, changedIds } = recalcTree(withLeaf, new Map([[branch.id, branchLeaves]]))
    setTree(next)
    flash([leaf.id, ...changedIds])
  }

  const panelMotion = {
    initial: { opacity: 0, x: 36 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 36 },
    transition: { duration: prefersReducedMotion() ? 0 : 0.25 },
  }

  return <main className="tree-page">
    <header className="app-header">
      <div className="brand"><TreeMark /> PorTree</div>
      <div className="goal"><small>YOUR GOAL</small><strong>{tree.goal.title}</strong></div>
      <button className="post-btn" onClick={() => setPost(true)}>＋ 投稿</button>
      <button className="reset" onClick={() => setReview(true)}>振り返り</button>
      <button className="reset" onClick={onReset}>最初から</button>
    </header>
    <div className="map-heading">
      <div>
        <p className="eyebrow">{view.mode === 'overview' ? 'CURRENT MILESTONE' : 'FOCUS'}</p>
        <h1>{heading}</h1>
        <TreeBreadcrumbs crumbs={breadcrumbs} onNavigate={setView} />
      </div>
      <div className="heading-side">
        <span className="rate-badge">総合達成率: <strong>{rate}%</strong></span>
        <div className="legend"><span>✓ 習得済み</span><span>◆ 挑戦中</span><span>★ 隠しスキル</span><span>🍃 学習ステップ</span></div>
      </div>
    </div>
    <section className="map">
      <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} onInit={setRf} onNodeClick={onNodeClick} onPaneClick={back} nodesDraggable={false} fitView minZoom={.2} maxZoom={1.6}>
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
    <AnimatePresence mode="wait">
      {view.mode === 'trunk' && trunk && <motion.aside className="detail open" key={`trunk-${trunk.id}`} {...panelMotion}>
        <TrunkDetailPanel trunk={trunk} onFocusBranch={(bid) => focusBranch(trunk.id, bid)} onClose={back} />
      </motion.aside>}
      {view.mode === 'branch' && branch && <motion.aside className="detail open" key={`branch-${branch.id}`} {...panelMotion}>
        <BranchDetailPanel branch={branch} onChallenge={() => setQuiz(true)} onFocusLeaf={(lid) => focusLeaf(branch.trunk_id, branch.id, lid)} onClose={back} />
      </motion.aside>}
      {view.mode === 'leaf' && branch && leaf && <motion.aside className="detail open" key={`leaf-${leaf.id}`} {...panelMotion}>
        <LeafDetailPanel leaf={leaf} branch={branch} onDailyLog={handleDailyLog} onClose={back} />
      </motion.aside>}
    </AnimatePresence>
    {post && <ArtifactInputPanel treeId={treeId} tree={tree}
      focusedBranchId={view.mode === 'branch' || view.mode === 'leaf' ? view.branchId : undefined}
      onApplied={(nextTree, ids) => { setTree(nextTree); flash(ids) }}
      onClose={() => setPost(false)} />}
    {quiz && branch && <QuizModal treeId={treeId} nodeId={branch.id} label={branch.label} tree={tree} onClose={() => setQuiz(false)} onPassed={handleQuizPassed} />}
    {review && <ReviewModal treeId={treeId} tree={tree} onClose={() => setReview(false)} />}
  </main>
}
