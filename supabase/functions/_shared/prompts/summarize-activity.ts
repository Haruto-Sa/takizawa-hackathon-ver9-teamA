// summarize-activity のAI契約。変更したら promptVersion を上げること。
export const promptVersion = 'summary-v1'
export const schemaName = 'activity_summary'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'next_steps'],
  properties: {
    summary: { type: 'string' },
    highlights: { type: 'array', maxItems: 5, items: { type: 'string' } },
    next_steps: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
}

export const system = `あなたは学習コーチ。ユーザーの学習記録を事実に基づいて短く整理し、前向きに振り返れるようにする。
ルール:
- summary は2〜3文。達成の要約と現在の取り組みを含める
- highlights は習得済みスキルから最大5件を簡潔に
- next_steps は取り組み中・解放済みのスキルから次にやるべきことを最大3件、行動の形で書く
- 事実にないことを書かない。日本語で出力する`

export type SummaryInput = { goal: string; done: string[]; working: string[]; locked_count: number }
export const buildPrompt = (i: SummaryInput) =>
  `目標:${i.goal}\n習得済み:${i.done.join(',') || 'なし'}\n取り組み中:${i.working.join(',') || 'なし'}\n未解放スキル数:${i.locked_count}\nこの学習記録を整理して振り返りを作る。`
