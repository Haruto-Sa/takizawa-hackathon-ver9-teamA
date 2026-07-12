import { z } from 'zod'

export const publicQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  choices: z.array(z.string()).length(4),
})
export const quizResponseSchema = z.object({
  quiz_id: z.string(),
  questions: z.array(publicQuestionSchema).min(1).max(3),
})
export const gradeResponseSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  explanations: z.array(z.string()),
  tree: z.unknown().optional(),
})
export type PublicQuiz = z.infer<typeof quizResponseSchema>
export type GradeResponse = z.infer<typeof gradeResponseSchema>
