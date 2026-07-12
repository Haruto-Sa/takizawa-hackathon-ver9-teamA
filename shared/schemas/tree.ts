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

// ---------------------------------------------------------------------------
// v2 スキーマ (docs/20260712/skill-tree-project-master-prompt-v2.md §3 が唯一の基準)
// 木=Trunk / 枝=Branch / 葉=Leaf。legacy(v1)からは treeAdapter.normalizeTree で変換する。
// ---------------------------------------------------------------------------

export const trunkStatusSchema = milestoneStatusSchema
export const branchStatusSchema = nodeStatusSchema
export const leafStatusV2Schema = z.enum(['todo', 'doing', 'done', 'skipped'])
export const branchKindSchema = z.enum(['core', 'side_quest', 'hidden'])

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
  status: leafStatusV2Schema.default('todo'),
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
  kind: branchKindSchema.default('core'),
  status: branchStatusSchema,
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
  status: trunkStatusSchema,
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

export type TrunkStatus = z.infer<typeof trunkStatusSchema>
export type BranchStatus = z.infer<typeof branchStatusSchema>
export type LeafStatusV2 = z.infer<typeof leafStatusV2Schema>
export type BranchKind = z.infer<typeof branchKindSchema>
export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>
export type LeafV2 = z.infer<typeof leafV2Schema>
export type Branch = z.infer<typeof branchSchema>
export type Trunk = z.infer<typeof trunkSchema>
export type SkillTreeV2 = z.infer<typeof skillTreeV2Schema>
