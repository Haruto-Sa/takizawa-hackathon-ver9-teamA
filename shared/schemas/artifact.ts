import { z } from 'zod'

export const artifactSourceTypeSchema = z.enum(['note', 'url', 'diff', 'file'])
export type ArtifactSourceType = z.infer<typeof artifactSourceTypeSchema>

export const artifactMatchSchema = z.object({
  trunk_id: z.string().min(1),
  branch_id: z.string().min(1),
  leaf_id: z.string().optional(),
  confidence: z.number().min(0).max(1),
  progress_delta: z.number().int().min(0).max(30),
  completion_supported: z.boolean().default(false),
  reason: z.string(),
  evidence_excerpt: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export const artifactAnalysisSchema = z.object({
  summary: z.string(),
  matches: z.array(artifactMatchSchema),
  hidden_signals: z.array(z.object({
    hidden_branch_id: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  })).default([]),
  warnings: z.array(z.string()).default([]),
})

export const analyzeArtifactResponseSchema = z.object({
  submission_id: z.string(),
  analysis: artifactAnalysisSchema,
  tree: z.unknown().optional(),
  updated_node_ids: z.array(z.string()).default([]),
  revealed_branch_ids: z.array(z.string()).default([]),
  needs_confirmation: z.array(artifactMatchSchema).default([]),
})

export type ArtifactMatch = z.infer<typeof artifactMatchSchema>
export type ArtifactAnalysis = z.infer<typeof artifactAnalysisSchema>
export type AnalyzeArtifactResponse = z.infer<typeof analyzeArtifactResponseSchema>
