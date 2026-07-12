import type { Breadcrumb, TreeViewState } from '../../hooks/useTreeNavigation'

export function TreeBreadcrumbs({ crumbs, onNavigate }: { crumbs: Breadcrumb[]; onNavigate: (view: TreeViewState) => void }) {
  return <nav className="breadcrumbs" aria-label="ツリー階層">
    {crumbs.map((c, i) => {
      const isCurrent = i === crumbs.length - 1
      return <span key={`${c.label}-${i}`}>
        {i > 0 && <em aria-hidden>›</em>}
        <button className={isCurrent ? 'current' : ''} disabled={isCurrent} onClick={() => onNavigate(c.view)}>{c.label}</button>
      </span>
    })}
  </nav>
}
