import { z } from 'zod'

export const nodeStatusSchema = z.enum(['done', 'in_progress', 'unlocked', 'locked'])
export const milestoneStatusSchema = z.enum(['completed', 'current', 'upcoming', 'locked'])
export const evidenceSchema = z.object({
  type: z.enum(['quiz', 'artifact']),
  passed_at: z.string(),
  detail: z.record(z.string(), z.unknown()),
})
export const relatedTechSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  note: z.string(),
})
export const leafSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  status: z.enum(['todo', 'done']).default('todo'),
})
export const skillNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['normal', 'hidden']),
  status: nodeStatusSchema,
  prerequisite_ids: z.array(z.string()),
  how_to_learn: z.string().min(1),
  evidence: evidenceSchema.nullable(),
  related: z.array(relatedTechSchema).max(4).default([]),
  leaves: z.array(leafSchema).max(4).default([]),
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
export type RelatedTech = z.infer<typeof relatedTechSchema>
export type Leaf = z.infer<typeof leafSchema>
export type SkillNode = z.infer<typeof skillNodeSchema>
export type SkillTree = z.infer<typeof skillTreeSchema>
