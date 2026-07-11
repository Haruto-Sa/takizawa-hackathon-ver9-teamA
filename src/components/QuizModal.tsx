import { useEffect, useState } from 'react'
import { generateQuiz, gradeQuiz } from '../lib/api'
import type { PublicQuiz } from '../../shared/schemas/quiz'

export function QuizModal({ treeId, nodeId, label, onClose, onPassed }: { treeId:string; nodeId:string; label:string; onClose:()=>void; onPassed:()=>void }) {
  const [quiz,setQuiz]=useState<PublicQuiz|null>(null); const [answers,setAnswers]=useState<number[]>([]); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(true)
  useEffect(()=>{ generateQuiz(treeId,nodeId).then(setQuiz).catch(()=>setMessage('クイズを読み込めませんでした。')).finally(()=>setBusy(false)) },[treeId,nodeId])
  const submit=async()=>{if(!quiz)return;setBusy(true);try{const result=await gradeQuiz(quiz.quiz_id,answers);setMessage(result.passed?'クリア！ スキルが証明されました。':`もう一歩です。 ${result.explanations.join(' ')}`);if(result.passed)onPassed()}catch{setMessage('採点できませんでした。新しいクイズで再挑戦してください。')}finally{setBusy(false)}}
  return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true"><button className="close" onClick={onClose} aria-label="閉じる">×</button><p className="eyebrow">SKILL CHALLENGE</p><h2>{label}</h2>{busy&&!quiz&&<div className="loader">問題を準備しています…</div>}{quiz?.questions.map((q,qi)=><div className="question" key={q.id}><strong>{q.prompt}</strong>{q.choices.map((c,ci)=><label className={answers[qi]===ci?'choice selected':'choice'} key={c}><input type="radio" name={q.id} checked={answers[qi]===ci} onChange={()=>setAnswers((v)=>{const n=[...v];n[qi]=ci;return n})}/><span>{String.fromCharCode(65+ci)}</span>{c}</label>)}</div>)}{message&&<p className="result">{message}</p>}<button className="primary wide" disabled={busy||!quiz||answers.length!==quiz.questions.length} onClick={submit}>鍵を開ける</button></div></div>
}
