// generate-questions のAI契約。変更したら promptVersion を上げること。
export const promptVersion = 'questions-v1'
export const schemaName = 'follow_up_questions'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } },
  },
}

export const system = 'あなたは学習経験を確認するインタビュアー。実名や連絡先を尋ねない。'

export type QuestionsInput = { goal: string; tags: string[] }
export const buildPrompt = (i: QuestionsInput) =>
  `目標:${i.goal}\n経験タグ:${i.tags.join(',')}\n経験を確認する短い追加質問を1〜2問作る。`
