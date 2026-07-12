import { useState } from 'react'
import { generateQuestions, generateTree } from '../lib/api'
import { TreeMark } from '../components/TreeMark'
import type { SkillTreeV2 } from '../../shared/schemas/tree'

const goals = ['フロントエンドエンジニア', 'バックエンドエンジニア', 'AI・データ系エンジニア', 'UI/UXデザイナー']
const tagOptions = ['HTML/CSS', 'JavaScript', 'TypeScript', 'React', 'Python', 'Java', 'Git/GitHub', 'Figma']
export function Onboarding({ onComplete }: { onComplete: (id: string, tree: SkillTreeV2) => void }) {
  const [step, setStep] = useState(1); const [goal, setGoal] = useState(goals[0]); const [customGoal, setCustomGoal] = useState('')
  const [tags, setTags] = useState<string[]>([]); const [period, setPeriod] = useState('未経験〜3か月'); const [questions, setQuestions] = useState<string[]>([])
  const [details, setDetails] = useState<string[]>([]); const [interest, setInterest] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const next = async () => { setError(''); if (step === 2) { setLoading(true); setQuestions(await generateQuestions(customGoal || goal, tags)); setLoading(false) } setStep((v) => Math.min(4, v + 1)) }
  const finish = async () => { setLoading(true); setError(''); try { const result = await generateTree({ goal: customGoal || goal, tags: [...tags, `期間:${period}`], details, interests: interest }); onComplete(result.id, result.tree) } catch { setError('ツリーを作成できませんでした。もう一度お試しください。') } finally { setLoading(false) } }
  return <main className="onboarding"><header className="brand"><TreeMark /> PorTree</header><section className="onboarding-card"><div className="progress"><span>STEP {step} / 4</span><div>{[1,2,3,4].map((n)=><i key={n} className={n<=step?'active':''}/>)}</div></div>
    {step===1&&<><p className="eyebrow">まず、目指す場所を決めよう</p><h1>どんな自分になりたい？</h1><p className="lead">ゴールから逆算して、あなただけの学習ルートを描きます。</p><div className="goal-grid">{goals.map((g)=><button className={goal===g&&!customGoal?'selected':''} onClick={()=>{setGoal(g);setCustomGoal('')}} key={g}>{g}</button>)}</div><label>自由に入力<input value={customGoal} onChange={(e)=>setCustomGoal(e.target.value)} placeholder="例：人の役に立つWebサービスを作りたい" /></label></>}
    {step===2&&<><p className="eyebrow">現在地を教えてください</p><h1>触れたことのあるものは？</h1><p className="lead">少し試しただけでも大丈夫。複数選べます。</p><div className="tags">{tagOptions.map((t)=><button className={tags.includes(t)?'selected':''} onClick={()=>setTags((v)=>v.includes(t)?v.filter(x=>x!==t):[...v,t])} key={t}>{t}</button>)}</div><label>学習期間<select value={period} onChange={(e)=>setPeriod(e.target.value)}><option>未経験〜3か月</option><option>3か月〜1年</option><option>1年以上</option></select></label></>}
    {step===3&&<><p className="eyebrow">もう少しだけ深掘り</p><h1>あなたの経験を聞かせて</h1>{loading?<div className="loader">質問を考えています…</div>:questions.map((q,i)=><label key={q}>{q}<textarea value={details[i]??''} onChange={(e)=>setDetails((v)=>{const n=[...v];n[i]=e.target.value;return n})} placeholder="短い回答でOKです" /></label>)}</>}
    {step===4&&<><p className="eyebrow">最後に、寄り道をひとつ</p><h1>キャリア以外で伸ばしたいことは？</h1><p className="lead">あなたらしい「隠しスキル」としてマップに忍ばせます。</p><label>興味のあること<input value={interest} onChange={(e)=>setInterest(e.target.value)} placeholder="例：人に分かりやすく説明する力" /></label></>}
    {error&&<p className="error">{error}</p>}<footer>{step>1&&<button className="back" onClick={()=>setStep(step-1)}>戻る</button>}<button className="primary" disabled={loading} onClick={step===4?finish:next}>{step===4?'マップをつくる':'次へ'} <span>→</span></button></footer></section></main>
}
