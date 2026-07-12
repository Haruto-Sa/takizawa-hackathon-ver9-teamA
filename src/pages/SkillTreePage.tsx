import { useEffect, useMemo, useRef, useState } from 'react'
import { Controls, ReactFlow, type NodeMouseHandler, type ReactFlowInstance } from '@xyflow/react'
import { AnimatePresence, motion } from 'motion/react'
import type { LeafV2, SkillTreeV2 } from '../../shared/schemas/tree'
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
import { attachLeaves, normalizeTree } from '../lib/treeAdapter'
import { computeLeafUpdate, recalcTree } from '../lib/progressCore'
import { getOrGenerateLeaves, getTree, recordDailyLog } from '../lib/api'
import { currentTrunk, findBranch, findLeaf, findTrunk, overallProgress } from '../lib/treeSelectors'
import { useTreeNavigation } from '../hooks/useTreeNavigation'
import { useGrowthFlash } from '../hooks/useGrowthFlash'

const nodeTypes = { branch: BranchNodeCard, trunk: TrunkNode, start: StartNode, joint: JointNode, subskill: SubSkillNode, leaf: LeafNode }
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function mergeRows(prev: LeafV2[], next: LeafV2[]): LeafV2[] {
  const map = new Map(prev.map((l) => [`${l.branch_id}/${l.id}`, l]))
  next.forEach((l) => map.set(`${l.branch_id}/${l.id}`, l))
  return [...map.values()]
}

export function SkillTreePage({ treeId, initialTree, onReset }: { treeId: string; initialTree: SkillTreeV2; onReset: () => void }) {
  const [baseTree, setBaseTree] = useState(initialTree)
  const [leafRows, setLeafRows] = useState<LeafV2[]>([])
  const [quiz, setQuiz] = useState(false)
  const [review, setReview] = useState(false)
  const [post, setPost] = useState(false)
  const [loadingLeaves, setLoadingLeaves] = useState(false)
  const [rf, setRf] = useState<ReactFlowInstance<TreeFlowNode> | null>(null)
  const tree = useMemo(() => attachLeaves(baseTree, leafRows), [baseTree, leafRows])
  const { view, setView, focusTrunk, focusBranch, focusLeaf, back, breadcrumbs } = useTreeNavigation(tree)
  const { recentlyUpdatedIds, flash } = useGrowthFlash()
  const flow = useMemo(() => buildFlow(tree, view, { recentlyUpdatedIds }), [tree, view, recentlyUpdatedIds])
  const rate = overallProgress(tree)
  const trunk = view.mode !== 'overview' ? findTrunk(tree, view.trunkId) : undefined
  const branch = view.mode === 'branch' || view.mode === 'leaf' ? findBranch(tree, view.branchId) : undefined
  const leaf = view.mode === 'leaf' ? findLeaf(tree, view.branchId, view.leafId) : undefined
  const heading = view.mode === 'overview' ? (currentTrunk(tree)?.label ?? 'スキルマップ') : (trunk?.label ?? 'スキルマップ')
  const generating = useRef(new Set<string>())

  // ツリー全体の更新を反映し、既存の葉行にも新しい値を同期する
  const syncTree = (nextTree: SkillTreeV2, ids: string[] = []) => {
    setBaseTree(nextTree)
    setLeafRows((prev) => prev.map((r) => findLeaf(nextTree, r.branch_id, r.id) ?? r))
    if (ids.length) flash(ids)
  }

  // サーバーがあれば正のツリーと葉を取得
  useEffect(() => {
    if (treeId === 'demo') return
    getTree(treeId).then((res) => {
      if (res) { setBaseTree(res.tree); setLeafRows(res.leaves) }
    })
  }, [treeId])

  // 葉の遅延生成: 枝フォーカス時、未生成なら取得(2回目以降はサーバーがAIを呼ばない)
  useEffect(() => {
    if (view.mode !== 'branch' || !branch) return
    if (branch.leaves_generated || (branch.leaves?.length ?? 0) > 0 || generating.current.has(branch.id)) return
    generating.current.add(branch.id)
    setLoadingLeaves(true)
    getOrGenerateLeaves(treeId, branch.id, branch.label)
      .then((res) => {
        setLeafRows((prev) => mergeRows(prev, res.leaves))
        setBaseTree((prev) => ({ ...prev, trunks: prev.trunks.map((t) => ({ ...t, branches: t.branches.map((b) => (b.id === branch.id ? { ...b, leaves_generated: true } : b)) })) }))
        flash(res.leaves.map((l) => l.id))
      })
      .finally(() => setLoadingLeaves(false))
  }, [view, branch, treeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rf) return
    const duration = prefersReducedMotion() ? 0 : 750
    const t = setTimeout(() => {
      if (view.mode === 'overview' || flow.focusIds.length === 0) rf.fitView({ duration, padding: 0.15 })
      else rf.fitView({ nodes: flow.focusIds.map((id) => ({ id })), duration, padding: view.mode === 'trunk' ? 0.2 : 0.4 })
    }, 40)
    return () => clearTimeout(t)
  }, [rf, view, loadingLeaves]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (result.tree) syncTree(normalizeTree(result.tree, { id: treeId }), result.updated_node_ids ?? (branch ? [branch.id] : []))
  }

  // ローカル反映(デモ・サーバー障害時のフォールバック)
  const applyLocalLog = (input: DailyLogFormInput) => {
    if (!branch || !leaf) return
    const updated = computeLeafUpdate(leaf, { studied_minutes: input.studiedMinutes, completed: input.completed })
    const branchLeaves = (branch.leaves ?? []).map((l) => (l.id === leaf.id ? updated : l))
    setLeafRows((prev) => mergeRows(prev, branchLeaves))
    const { tree: nextBase, changedIds } = recalcTree(baseTree, new Map([[branch.id, branchLeaves]]))
    setBaseTree(nextBase)
    flash([leaf.id, ...changedIds])
  }

  const handleDailyLog = async (input: DailyLogFormInput) => {
    if (!branch || !leaf) return
    if (treeId === 'demo') { applyLocalLog(input); return }
    try {
      const r = await recordDailyLog({ treeId, branchId: branch.id, leafId: leaf.id, note: input.note, studiedMinutes: input.studiedMinutes, completed: input.completed })
      setBaseTree(r.tree)
      if (r.leaf) setLeafRows((prev) => mergeRows(prev, [r.leaf!]))
      flash(r.updatedNodeIds)
    } catch { applyLocalLog(input) }
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
        <BranchDetailPanel branch={branch} loadingLeaves={loadingLeaves} onChallenge={() => setQuiz(true)} onFocusLeaf={(lid) => focusLeaf(branch.trunk_id, branch.id, lid)} onClose={back} />
      </motion.aside>}
      {view.mode === 'leaf' && branch && leaf && <motion.aside className="detail open" key={`leaf-${leaf.id}`} {...panelMotion}>
        <LeafDetailPanel leaf={leaf} branch={branch} onDailyLog={handleDailyLog} onClose={back} />
      </motion.aside>}
    </AnimatePresence>
    {post && <ArtifactInputPanel treeId={treeId} tree={tree}
      focusedBranchId={view.mode === 'branch' || view.mode === 'leaf' ? view.branchId : undefined}
      onApplied={(nextTree, ids) => syncTree(nextTree, ids)}
      onClose={() => setPost(false)} />}
    {quiz && branch && <QuizModal treeId={treeId} nodeId={branch.id} label={branch.label} tree={tree} onClose={() => setQuiz(false)} onPassed={handleQuizPassed} />}
    {review && <ReviewModal treeId={treeId} tree={tree} onClose={() => setReview(false)} />}
  </main>
}
