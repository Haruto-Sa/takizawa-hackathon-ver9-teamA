# AGENTS.md — スキルツリー型AIキャリア支援サービス

このリポジトリ(github.com/Haruto-Sa/takizawa-hackathon-ver9-teamA)で作業する
AIエージェント(Claude Code / Codex)への共通指示。
全体仕様は `docs/skilltree_project_master_prompt.md`、ベースラインデータは
`docs/skilltree_baselines.md`、API入出力は `docs/api-contracts.md` を必ず参照すること。

## プロジェクト概要(1行)

学生向けに、目標から逆算した3階層スキルツリー(木=技術領域 / 枝=週単位の学習単元 /
葉=毎日のタスク)をAIが生成し、日次記録とクイズ検証で成長を資産化するWebアプリ。
ハッカソン(1〜2日)のMVP。

## 技術スタック

- フロント: React 19 + Vite + TypeScript + react-router-dom(HashRouter)
- ツリー描画: `@xyflow/react` v12(旧 `reactflow` は使わない)+ `@dagrejs/dagre`(自動レイアウト)
  - ズームフォーカスは `fitView` / `fitBounds`(duration付き)。非関連ノードは薄表示
- スタイル: Tailwind CSS 4(vite.config.ts に `tailwindcss()` プラグイン追加。
  global.css で `@import "tailwindcss"` の後に `@xyflow/react/dist/style.css` を読み込む)
- スキーマ検証: zod
- バックエンド: Supabase(Auth匿名ログイン / Postgres+RLS / Edge Functions=Deno+TypeScript)
- AI: OpenAI **Responses API + Structured Outputs**。モデルIDは環境変数 `OPENAI_MODEL`
- ホスティング: GitHub Pages(vite.config.ts の base は '/takizawa-hackathon-ver9-teamA/')
- バージョンの正は package.json と package-lock.json。インストールは `npm ci` を使う

## ディレクトリ構成

```
/shared/schemas   tree.ts / quiz.ts — zodスキーマの唯一の正。
                  フロントとEdge Functionsの両方からここを直接importする(コピー禁止)
/src              components/(SkillTreePage, LeafDetailPanel, DailyLogForm 等)
                  pages/ lib/(supabase.ts api.ts layout.ts) types/
/supabase
  /functions      generate-questions / generate-tree / get-or-generate-leaves /
                  generate-quiz / grade-quiz / _shared
  /migrations     SQL(スキーマとRLSポリシー)
/docs             仕様書・ベースライン・api-contracts・acceptance-criteria・demo-fixtures・design
/tests
/.github/workflows  ci.yml(typecheck+test+build)/ pages.yml(デプロイ)
```

## 絶対に守るルール(セキュリティ)

- OpenAIのAPIキーをフロントのコード・`VITE_*` 環境変数に置かない。AI呼び出しは必ずEdge Functions経由
- **クイズの正解・解説をフロントに送らない**。generate-quizは quiz_id・問題文・選択肢のみ返し、
  全体は quiz_sessions テーブルに保存。採点は grade-quiz 内で行う
- 枝の `done` への遷移・木の `completed` 判定・unlocked伝播・achievements追加は
  grade-quiz 内の**1トランザクション**でのみ行う。同一 quiz_id の二重送信は used_at で拒否する
- RLS: profiles=自分の行のselect/insert/update、trees・achievements=selectのみ、
  leaves=select+update(自己申告完了)、daily_logs=select+insert、
  quiz_sessions・leaf_generations=フロントから一切アクセス不可。この方針を緩めるポリシーを書かない
- Edge FunctionsはService RoleキーでRLSを迂回する。**全関数でJWTを検証し、
  user_idと対象データの所有者を明示的に照合する**コードを省略しない
- ユーザーの本名・連絡先をAIに送信するコードを書かない(データ共有オプトイン中のため)
- シークレットをコミットしない。`.env` は `.gitignore` に含め、`.env.example` を用意する

## データ規約(3階層)

- 状態の列挙型は階層ごとに分ける:
  Trunk = `completed | current | upcoming | locked` /
  Branch = `done | in_progress | unlocked | locked` /
  Leaf = `todo | doing | done | skipped`
- **検証の分担**: 葉は自己申告で完了可(daily_logsに記録)。
  枝の `done` はサーバー(grade-quiz)だけが設定する。AI生成時・フロントで割り当てない。
  クイズは枝単位のみ(葉ごとに作らない)
- 木+枝は `trees.tree_data`(jsonb)に保存。**葉と日次記録は leaves / daily_logs の独立テーブル**
- **葉は遅延生成**: get-or-generate-leaves はDBに保存済みならAIを呼ばない。
  重複生成は request_hash(leaf_generationsテーブル)で防止する
- 依存関係は `prerequisite_ids`。React FlowのEdgeはここから生成する
- 隠し要素は枝の `kind: "hidden"` で表す
- AI出力は必ず `shared/schemas/` のzodスキーマで検証してから使う。失敗時は
  1回リトライ → 固定デモデータ(docs/demo-fixtures.md)にフォールバック
- refusal・不完全出力・タイムアウトは個別にハンドリングする

## コーディング規約

- TypeScript strict。`any` を使わない
- コンポーネントは関数コンポーネント+named export
- 最小変更の原則: 依頼されていないリファクタリングをしない
- 変更ごとに `npm run typecheck` を実行してから完了報告する
- コミットは論理単位で分割する(1機能1コミット)

## コマンド(この文字列を正確に使う)

- 依存インストール: `npm ci`
- 開発サーバー: `npm run dev`
- 型チェック: `npm run typecheck`
- テスト: `npm run test`
- ビルド: `npm run build`
- Edge Functionsローカル実行: `supabase functions serve`(Docker必須)
- Edge Functionsデプロイ: `supabase functions deploy <name>`

## 迷ったとき

- 実装方針が2案ある場合は、両案を短く説明してユーザーに選ばせる
- 仕様の疑問は docs/ の該当ファイルを先に確認する。矛盾を見つけたら実装せず報告する