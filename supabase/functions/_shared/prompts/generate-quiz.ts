// generate-quiz のAI契約。変更したら promptVersion を上げること。
export const promptVersion = 'quiz-v1'
export const schemaName = 'skill_quiz'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'prompt', 'choices', 'correct_index', 'explanation'],
        properties: {
          id: { type: 'string' },
          prompt: { type: 'string' },
          choices: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
        },
      },
    },
  },
}

export const system = 'あなたは学習内容の理解度を検証する出題者。'

export type QuizInput = { nodeLabel: string }
export const buildPrompt = (i: QuizInput) =>
  `スキル「${i.nodeLabel}」の理解を検証する入門4択クイズを1〜3問作る。正解は1つ。`
