import { useState } from 'react'
import type { SkillTree } from '../shared/schemas/tree'
import { Onboarding } from './pages/Onboarding'
import { SkillTreePage } from './pages/SkillTreePage'

export default function App() {
  const [result, setResult] = useState<{ id: string; tree: SkillTree } | null>(null)
  return result
    ? <SkillTreePage treeId={result.id} initialTree={result.tree} onReset={() => setResult(null)} />
    : <Onboarding onComplete={(id, tree) => setResult({ id, tree })} />
}
