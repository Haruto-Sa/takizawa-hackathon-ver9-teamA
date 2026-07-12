import { skillTreeV2Schema, type SkillTreeV2 } from '../tree-schema.ts'

// generate-tree のAI契約。変更したら promptVersion を上げること。
// tree-v4: v2形状(Trunk/Branch)を直接生成する。葉は生成しない(get-or-generate-leavesで遅延生成)。
export const promptVersion = 'tree-v4'
export const schemaName = 'skill_tree_v2'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['goal', 'start_summary', 'trunks'],
  properties: {
    goal: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description'],
      properties: { title: { type: 'string' }, description: { type: 'string' } },
    },
    start_summary: { type: 'string' },
    trunks: {
      type: 'array',
      minItems: 4,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'description', 'status', 'prerequisite_ids', 'branches'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          status: { enum: ['current', 'upcoming', 'locked'] },
          prerequisite_ids: { type: 'array', items: { type: 'string' } },
          branches: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'label', 'description', 'kind', 'status', 'estimated_days', 'prerequisite_ids', 'related'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
                kind: { enum: ['core'] },
                status: { enum: ['in_progress', 'unlocked', 'locked'] },
                estimated_days: { type: 'integer', minimum: 1, maximum: 21 },
                prerequisite_ids: { type: 'array', items: { type: 'string' } },
                related: {
                  type: 'array',
                  maxItems: 4,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'label', 'note'],
                    properties: { id: { type: 'string' }, label: { type: 'string' }, note: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export const system = `あなたは学習ロードマップの設計者。ユーザーの自由入力から、目標(Goal)と現在地(Start)を逆算したスキルツリーをJSONで出力する。
ルール:
- 目標が曖昧な自由記述でも、ドメインを推測して goal.title を目標像として正規化する
- 木(Trunk)= 主要技術領域(粒度1〜3か月)を4〜7本、Startに近い順に生成する
- 各木に枝(Branch)= 学習単元(粒度3日〜2週間)を2〜5本生成する
- 現在地に近い枝だけ in_progress / unlocked、先の枝は locked。done は絶対に使わない
- current の木は1本だけ。prerequisite_ids を循環させない
- estimated_days は学習条件(1日の時間・週の日数)を反映して見積もる
- 各枝に関連技術 related を0〜4件付与する(labelと一言note、idは「{枝id}-r1」形式)
- 葉(日次タスク)は生成しない`

export type LearningConditions = {
  daily_minutes?: number
  days_per_week?: number
  target_date?: string
  style?: string
  purpose?: string
  version?: number
} | null

export type TreeInput = { goal: string; tags: string[]; details: string[]; interests: string; learning_conditions: LearningConditions }
export const buildPrompt = (i: TreeInput) => {
  const lc = i.learning_conditions
  return `目標:${i.goal}\n経験:${i.tags.join(',')}\n回答:${i.details.join(',')}\n関心:${i.interests}` +
    (lc ? `\n学習条件: 1日${lc.daily_minutes ?? '?'}分 / 週${lc.days_per_week ?? '?'}日 / 期日:${lc.target_date ?? '未定'} / スタイル:${lc.style ?? '未定'} / 目的:${lc.purpose ?? '未定'}` : '')
}

type GeneratedTree = {
  goal: { title: string; description: string }
  start_summary: string
  trunks: Array<{
    id: string; label: string; description: string; status: string; prerequisite_ids: string[]
    branches: Array<{ id: string; label: string; description: string; kind: string; status: string; estimated_days: number; prerequisite_ids: string[]; related: Array<{ id: string; label: string; note: string }> }>
  }>
}

// AI出力(生成用の簡約スキーマ)を完全な SkillTreeV2 に組み立てて検証する
export function assemble(raw: unknown, treeId: string): SkillTreeV2 {
  const gen = raw as GeneratedTree
  return skillTreeV2Schema.parse({
    schema_version: 2,
    id: treeId,
    goal: { title: gen.goal.title, description: gen.goal.description },
    start: { summary: gen.start_summary, assessed_at: new Date().toISOString() },
    trunks: gen.trunks.map((t, i) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      order: i,
      status: t.status,
      progress: 0,
      prerequisite_ids: t.prerequisite_ids,
      branches: t.branches.map((b) => ({
        id: b.id,
        trunk_id: t.id,
        label: b.label,
        description: b.description,
        kind: b.kind,
        status: b.status,
        progress: 0,
        estimated_days: b.estimated_days,
        prerequisite_ids: b.prerequisite_ids,
        leaves_generated: false,
        revealed: true,
        evidence: [],
        related: b.related,
      })),
    })),
  })
}
