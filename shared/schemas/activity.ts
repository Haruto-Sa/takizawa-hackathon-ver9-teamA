import { z } from 'zod'

export const activitySummarySchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string()).max(5),
  next_steps: z.array(z.string()).max(3),
})
export type ActivitySummary = z.infer<typeof activitySummarySchema>
