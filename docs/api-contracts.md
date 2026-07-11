# Edge Functions API契約

全関数は `Authorization: Bearer <JWT>` を必須とし、入力値と対象データの所有者を照合する。

- `generate-questions`: `{ goal: string, tags: string[] }` → `{ questions: string[1..2] }`
- `generate-tree`: `{ goal, tags, details, interests }` → `{ id, tree, fallback? }`。treeの各ノードは関連技術 `related: { id, label, note }[]`(0〜4件)を含む。
- `generate-quiz`: `{ tree_id, node_id }` → `{ quiz_id, questions: [{ id, prompt, choices }] }`。正解・解説は返さない。
- `grade-quiz`: `{ quiz_id, answers: number[] }` → `{ passed, score, explanations, tree? }`

同じ `quiz_id` の再採点、期限切れ、所有者不一致は拒否する。合格時のtree更新、解放伝播、achievement追加、used_at更新はDB関数内の1トランザクションで行う。

generate-* の各関数はAI呼び出しの入出力(prompt_version・model・latency・エラー含む)をサーバー側で `generation_logs` テーブルに記録する(クライアントAPIではない)。プロンプト本体とチューニングは `supabase/functions/_shared/prompts/` で管理する。
