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
export type LegacySkillTree = z.infer<typeof skillTreeSchema>
export type LegacySkillNode = z.infer<typeof skillNodeSchema>

// ---------------------------------------------------------------------------
// v2 (shared/schemas/tree.ts と同期)
// ---------------------------------------------------------------------------

export type HiddenRevealCondition =
  | { type: 'branch_progress'; branch_ids: string[]; minimum: number }
  | { type: 'evidence_tag'; tags: string[]; minimum_count: number }
  | { type: 'side_quest_complete'; branch_ids: string[] }
  | { type: 'all'; conditions: HiddenRevealCondition[] }

export const hiddenRevealConditionSchema: z.ZodType<HiddenRevealCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('branch_progress'), branch_ids: z.array(z.string()), minimum: z.number() }),
    z.object({ type: z.literal('evidence_tag'), tags: z.array(z.string()), minimum_count: z.number() }),
    z.object({ type: z.literal('side_quest_complete'), branch_ids: z.array(z.string()) }),
    z.object({ type: z.literal('all'), conditions: z.array(hiddenRevealConditionSchema) }),
  ]),
)

export const evidenceSummarySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['quiz', 'daily_log', 'artifact', 'diff']),
  verified: z.boolean(),
  score: z.number().optional(),
  created_at: z.string(),
})

export const leafV2Schema = z.object({
  id: z.string().min(1),
  branch_id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(''),
  completion_condition: z.string().default(''),
  estimated_minutes: z.number().int().positive().default(30),
  scheduled_date: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done', 'skipped']).default('todo'),
  progress: z.number().int().min(0).max(100).default(0),
  evidence_count: z.number().int().min(0).default(0),
  recently_updated_at: z.string().optional(),
})

export const branchSchema = z.object({
  id: z.string().min(1),
  trunk_id: z.string().min(1),
  parent_branch_id: z.string().optional(),
  label: z.string().min(1),
  description: z.string().default(''),
  kind: z.enum(['core', 'side_quest', 'hidden']).default('core'),
  status: z.enum(['done', 'in_progress', 'unlocked', 'locked']),
  progress: z.number().int().min(0).max(100).default(0),
  estimated_days: z.number().int().positive().default(7),
  prerequisite_ids: z.array(z.string()).default([]),
  leaves_generated: z.boolean().default(false),
  revealed: z.boolean().default(true),
  reveal_condition: hiddenRevealConditionSchema.optional(),
  evidence: z.array(evidenceSummarySchema).default([]),
  related: z.array(relatedTechSchema).max(4).default([]),
  leaves: z.array(leafV2Schema).optional(),
})

export const trunkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(''),
  order: z.number().int(),
  status: z.enum(['completed', 'current', 'upcoming', 'locked']),
  progress: z.number().int().min(0).max(100).default(0),
  prerequisite_ids: z.array(z.string()).default([]),
  branches: z.array(branchSchema),
})

export const skillTreeV2Schema = z.object({
  schema_version: z.literal(2),
  id: z.string(),
  user_id: z.string().optional(),
  goal: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    target_date: z.string().optional(),
  }),
  start: z.object({
    summary: z.string(),
    assessed_at: z.string(),
  }),
  trunks: z.array(trunkSchema).min(1),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>
export type LeafV2 = z.infer<typeof leafV2Schema>
export type Branch = z.infer<typeof branchSchema>
export type Trunk = z.infer<typeof trunkSchema>
export type SkillTreeV2 = z.infer<typeof skillTreeV2Schema>
