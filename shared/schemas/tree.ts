import { z } from 'zod'

export const nodeStatusSchema = z.enum(['done', 'in_progress', 'unlocked', 'locked'])
export const milestoneStatusSchema = z.enum(['completed', 'current', 'upcoming', 'locked'])
export const evidenceSchema = z.object({
  type: z.enum(['quiz', 'artifact']),
  passed_at: z.string(),
  detail: z.record(z.string(), z.unknown()),
})
export const skillNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['normal', 'hidden']),
  status: nodeStatusSchema,
  prerequisite_ids: z.array(z.string()),
  how_to_learn: z.string().min(1),
  evidence: evidenceSchema.nullable(),
})
export const milestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: milestoneStatusSchema,
  nodes: z.array(skillNodeSchema),
})
export const skillTreeSchema = z.object({
  goal: z.string().min(1),
  milestones: z.array(milestoneSchema).min(1),
})
export type SkillNode = z.infer<typeof skillNodeSchema>
export type SkillTree = z.infer<typeof skillTreeSchema>
