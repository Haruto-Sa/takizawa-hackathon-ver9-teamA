// get-or-generate-leaves のAI契約。変更したら promptVersion を上げること。
export const promptVersion = 'leaves-v1'
export const schemaName = 'branch_leaves'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['leaves'],
  properties: {
    leaves: {
      type: 'array',
      minItems: 5,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'description', 'completion_condition', 'estimated_minutes'],
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          completion_condition: { type: 'string' },
          estimated_minutes: { type: 'integer', minimum: 15, maximum: 240 },
        },
      },
    },
  },
}

export const system = `あなたは学習コーチ。指定された枝(学習単元)を、1回のセッションで実行できる具体的な行動タスク(葉)に分解する。
ルール:
- 葉は5〜7枚。label は動詞で終える(例:「〜を実装する」「〜を試す」)
- 読むだけで終わらせず、小さな出力(コード・メモ・成果物)を含める
- completion_condition(何をもって完了か)を必ず書く
- estimated_minutes はユーザーの1日の利用可能時間以内に収める
- 学習スタイル(本/動画/実践)を反映する
- 最終の葉は小さな成果物づくり、または振り返りにする`

export type LeavesInput = {
  goal: string
  trunk_label: string
  branch_label: string
  branch_description: string
  daily_minutes?: number
  style?: string
}
export const buildPrompt = (i: LeavesInput) =>
  `目標:${i.goal}\n木(領域):${i.trunk_label}\n枝(学習単元):${i.branch_label}\n枝の説明:${i.branch_description}\n1日の利用可能時間:${i.daily_minutes ?? 60}分\n学習スタイル:${i.style ?? 'mixed'}\nこの枝の葉(日次タスク)を設計する。`
