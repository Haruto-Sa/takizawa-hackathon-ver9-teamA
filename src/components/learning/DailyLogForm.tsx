import { useState } from 'react'
import type { LeafV2 } from '../../../shared/schemas/tree'

export type DailyLogFormInput = { note: string; studiedMinutes: number; completed: boolean }

export function DailyLogForm({ leaf, onSubmit }: { leaf: LeafV2; onSubmit: (input: DailyLogFormInput) => Promise<void> | void }) {
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [completed, setCompleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit({ note, studiedMinutes: minutes, completed })
      setSaved(true)
      setNote('')
    } finally { setBusy(false) }
  }
  if (leaf.status === 'done') return <div className="verified">✓ このステップは完了しています</div>
  return <div className="daily-log">
    <span className="block-title">今日の記録</span>
    <label className="post-label">学習メモ<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="やったこと・気づき・つまずいた点" /></label>
    <div className="log-row">
      <label className="post-label">時間(分)<input type="number" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))} /></label>
      <label className="check-label"><input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} /> 完了した</label>
    </div>
    {saved && <p className="result">記録しました！🍃</p>}
    <button className="primary wide" disabled={busy} onClick={submit}>{busy ? '保存中…' : '記録する'}</button>
  </div>
}
