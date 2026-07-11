import { z } from 'npm:zod@4.4.3'

// Supabase's remote bundler cannot apply an import map to files outside
// supabase/functions. Keep this schema in sync with shared/schemas/tree.ts.
const evidenceSchema = z.object({
  type: z.enum(['quiz', 'artifact']),
  passed_at: z.string(),
  detail: z.record(z.string(), z.unknown()),
})

const relatedTechSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  note: z.string(),
})

const leafSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  status: z.enum(['todo', 'done']).default('todo'),
})

const skillNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['normal', 'hidden']),
  status: z.enum(['done', 'in_progress', 'unlocked', 'locked']),
  prerequisite_ids: z.array(z.string()),
  how_to_learn: z.string().min(1),
  evidence: evidenceSchema.nullable(),
  related: z.array(relatedTechSchema).max(4).default([]),
  leaves: z.array(leafSchema).max(4).default([]),
})

const milestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['completed', 'current', 'upcoming', 'locked']),
  nodes: z.array(skillNodeSchema),
})

export const skillTreeSchema = z.object({
  goal: z.string().min(1),
  milestones: z.array(milestoneSchema).min(1),
})
