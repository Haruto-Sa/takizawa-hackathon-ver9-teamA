// generate-tree のAI契約(プロンプト・スキーマ・バージョン)を集約する。
// 変更したら promptVersion を上げること(generation_logs で追跡できる)。
export const promptVersion = 'tree-v3'
export const schemaName = 'skill_tree'

export const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['goal', 'milestones'],
  properties: {
    goal: { type: 'string' },
    milestones: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'status', 'nodes'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          status: { enum: ['completed', 'current', 'upcoming', 'locked'] },
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'label', 'kind', 'status', 'prerequisite_ids', 'how_to_learn', 'evidence', 'related', 'leaves'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                kind: { enum: ['normal', 'hidden'] },
                status: { enum: ['in_progress', 'unlocked', 'locked'] },
                prerequisite_ids: { type: 'array', items: { type: 'string' } },
                how_to_learn: { type: 'string' },
                evidence: { type: 'null' },
                related: {
                  type: 'array',
                  maxItems: 4,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'label', 'note'],
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      note: { type: 'string' },
                    },
                  },
                },
                leaves: {
                  type: 'array',
                  maxItems: 4,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'label', 'description'],
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      description: { type: 'string' },
                    },
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

export const system = `あなたは学習ロードマップの設計者。ユーザーの自由入力からスキルツリーをJSONで出力する。
ルール:
- 目標が曖昧な自由記述でも、ドメインを推測して goal を目標像として正規化する
- IT共通幹（基礎、Git、Web）から目標職種へ進む4〜6個のマイルストーンを作る
- すべてのマイルストーンに枝（ノード）を2〜4本作る。current のマイルストーンは3〜4本と厚めにする
- current 以外のマイルストーンのノードは status=locked にする。current 内は in_progress / unlocked / locked を経験に応じて割り当てる
- status に done を使わない。prerequisite_ids を循環させない
- kind=hidden のノードを全体でちょうど1つ、current のマイルストーンに含める
- 各ノードに葉 leaves を2〜4枚付与する。1回の学習セッションでできる小さなタスクを label に、進め方の一言を description に書き、id は「{ノードid}-l1」の形式にする
- 各ノードに関連技術 related を0〜4件付与する。label と、なぜ関連するかの一言 note を書き、id は「{ノードid}-r1」の形式にする`

export type TreeInput = { goal: string; tags: string[]; details: string[]; interests: string }
export const buildPrompt = (i: TreeInput) =>
  `目標:${i.goal}\n経験:${i.tags.join(',')}\n回答:${i.details.join(',')}\n関心:${i.interests}`
