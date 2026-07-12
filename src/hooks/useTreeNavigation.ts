import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SkillTreeV2 } from '../../shared/schemas/tree'
import { findBranch, findLeaf, findTrunk } from '../lib/treeSelectors'

export type TreeViewState =
  | { mode: 'overview' }
  | { mode: 'trunk'; trunkId: string }
  | { mode: 'branch'; trunkId: string; branchId: string }
  | { mode: 'leaf'; trunkId: string; branchId: string; leafId: string }

export type Breadcrumb = { label: string; view: TreeViewState }

export function useTreeNavigation(tree: SkillTreeV2 | null) {
  const [view, setView] = useState<TreeViewState>({ mode: 'overview' })

  const focusTrunk = useCallback((trunkId: string) => setView({ mode: 'trunk', trunkId }), [])
  const focusBranch = useCallback((trunkId: string, branchId: string) => setView({ mode: 'branch', trunkId, branchId }), [])
  const focusLeaf = useCallback((trunkId: string, branchId: string, leafId: string) => setView({ mode: 'leaf', trunkId, branchId, leafId }), [])
  const reset = useCallback(() => setView({ mode: 'overview' }), [])

  const back = useCallback(() => {
    setView((v) => {
      switch (v.mode) {
        case 'leaf': return { mode: 'branch', trunkId: v.trunkId, branchId: v.branchId }
        case 'branch': return { mode: 'trunk', trunkId: v.trunkId }
        case 'trunk': return { mode: 'overview' }
        default: return v
      }
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  const breadcrumbs = useMemo((): Breadcrumb[] => {
    const crumbs: Breadcrumb[] = [{ label: '全体', view: { mode: 'overview' } }]
    if (!tree || view.mode === 'overview') return crumbs
    const trunk = findTrunk(tree, view.trunkId)
    crumbs.push({ label: trunk?.label ?? '木', view: { mode: 'trunk', trunkId: view.trunkId } })
    if (view.mode === 'trunk') return crumbs
    const branch = findBranch(tree, view.branchId)
    crumbs.push({ label: branch?.label ?? '枝', view: { mode: 'branch', trunkId: view.trunkId, branchId: view.branchId } })
    if (view.mode === 'branch') return crumbs
    const leaf = findLeaf(tree, view.branchId, view.leafId)
    crumbs.push({ label: leaf?.label ?? '葉', view })
    return crumbs
  }, [tree, view])

  return { view, setView, focusTrunk, focusBranch, focusLeaf, back, reset, breadcrumbs }
}
