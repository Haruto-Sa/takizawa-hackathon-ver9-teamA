import { useState } from 'react'
import { generateQuestions, generateTree } from '../lib/api'
import { TreeMark } from '../components/TreeMark'
import type { SkillTreeV2 } from '../../shared/schemas/tree'

const goals = ['フロントエンドエンジニア', 'バックエンドエンジニア', 'AI・データ系エンジニア', 'UI/UXデザイナー']
const tagOptions = ['HTML/CSS', 'JavaScript', 'TypeScript', 'React', 'Python', 'Java', 'Git/GitHub', 'Figma']
const styleOptions = [{ v: 'book', l: '本・記事で読む' }, { v: 'video', l: '動画で学ぶ' }, { v: 'practice', l: '手を動かす' }, { v: 'mixed', l: 'ミックス' }]
const purposeOptions = [{ v: 'job', l: '就職・転職' }, { v: 'personal_project', l: '個人開発' }, { v: 'qualification', l: '資格取得' }, { v: 'class', l: '授業・研究' }, { v: 'other', l: 'その他' }]

export function Onboarding({ onComplete }: { onComplete: (id: string, tree: SkillTreeV2) => void }) {
  const [step, setStep] = useState(1); const [goal, setGoal] = useState(goals[0]); const [customGoal, setCustomGoal] = useState('')
  const [tags, setTags] = useState<string[]>([]); const [period, setPeriod] = useState('未経験〜3か月'); const [questions, setQuestions] = useState<string[]>([])
  const [details, setDetails] = useState<string[]>([]); const [interest, setInterest] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const [minutesPerDay, setMinutesPerDay] = useState(60); const [daysPerWeek, setDaysPerWeek] = useState(5); const [targetDate, setTargetDate] = useState(''); const [style, setStyle] = useState('mixed'); const [purpose, setPurpose] = useState('job')
  const next = async () => { setError(''); if (step === 3) { setLoading(true); setQuestions(await generateQuestions(customGoal || goal, tags)); setLoading(false) } setStep((v) => Math.min(5, v + 1)) }
  const finish = async () => {
    setLoading(true); setError('')
    try {
      const result = await generateTree({
        goal: customGoal || goal,
        tags: [...tags, `期間:${period}`],
        details,
        interests: interest,
        learning_conditions: { daily_minutes: minutesPerDay, days_per_week: daysPerWeek, target_date: targetDate || undefined, style, purpose, version: 1 },
      })
      onComplete(result.id, result.tree)
    } catch { setError('ツリーを作成できませんでした。もう一度お試しください。') } finally { setLoading(false) }
  }
  return <main className="onboarding"><header className="brand"><TreeMark /> PorTree</header><section className="onboarding-card"><div className="progress"><span>STEP {step} / 5</span><div>{[1,2,3,4,5].map((n)=><i key={n} className={n<=step?'active':''}/>)}</div></div>
    {step===1&&<><p className="eyebrow">まず、目指す場所を決めよう</p><h1>どんな自分になりたい？</h1><p className="lead">ゴールから逆算して、あなただけの学習ルートを描きます。</p><div className="goal-grid">{goals.map((g)=><button className={goal===g&&!customGoal?'selected':''} onClick={()=>{setGoal(g);setCustomGoal('')}} key={g}>{g}</button>)}</div><label>自由に入力<input value={customGoal} onChange={(e)=>setCustomGoal(e.target.value)} placeholder="例:人の役に立つWebサービスを作りたい" /></label></>}
    {step===2&&<><p className="eyebrow">現在地を教えてください</p><h1>触れたことのあるものは？</h1><p className="lead">少し試しただけでも大丈夫。複数選べます。</p><div className="tags">{tagOptions.map((t)=><button className={tags.includes(t)?'selected':''} onClick={()=>setTags((v)=>v.includes(t)?v.filter(x=>x!==t):[...v,t])} key={t}>{t}</button>)}</div><label>学習期間<select value={period} onChange={(e)=>setPeriod(e.target.value)}><option>未経験〜3か月</option><option>3か月〜1年</option><option>1年以上</option></select></label></>}
    {step===3&&<><p className="eyebrow">学習のペースを教えてください</p><h1>どれくらい取り組める？</h1><p className="lead">毎日のタスク(葉)の分量とスケジュールに反映します。</p>
      <div className="cond-grid">
        <label>1日に使える時間<select value={minutesPerDay} onChange={(e)=>setMinutesPerDay(Number(e.target.value))}><option value={15}>15分</option><option value={30}>30分</option><option value={60}>1時間</option><option value={120}>2時間以上</option></select></label>
        <label>週に取り組める日数<select value={daysPerWeek} onChange={(e)=>setDaysPerWeek(Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}日</option>)}</select></label>
        <label>目標達成予定日(任意)<input type="date" value={targetDate} onChange={(e)=>setTargetDate(e.target.value)} /></label>
        <label>学習スタイル<select value={style} onChange={(e)=>setStyle(e.target.value)}>{styleOptions.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
        <label>学習の目的<select value={purpose} onChange={(e)=>setPurpose(e.target.value)}>{purposeOptions.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
      </div></>}
    {step===4&&<><p className="eyebrow">もう少しだけ深掘り</p><h1>あなたの経験を聞かせて</h1>{loading?<div className="loader">質問を考えています…</div>:questions.map((q,i)=><label key={q}>{q}<textarea value={details[i]??''} onChange={(e)=>setDetails((v)=>{const n=[...v];n[i]=e.target.value;return n})} placeholder="短い回答でOKです" /></label>)}</>}
    {step===5&&<><p className="eyebrow">最後に、寄り道をひとつ</p><h1>キャリア以外で伸ばしたいことは？</h1><p className="lead">あなたらしい「隠しスキル」としてマップに忍ばせます。</p><label>興味のあること<input value={interest} onChange={(e)=>setInterest(e.target.value)} placeholder="例:人に分かりやすく説明する力" /></label></>}
    {error&&<p className="error">{error}</p>}<footer>{step>1&&<button className="back" onClick={()=>setStep(step-1)}>戻る</button>}<button className="primary" disabled={loading} onClick={step===5?finish:next}>{step===5?'マップをつくる':'次へ'} <span>→</span></button></footer></section></main>
}
