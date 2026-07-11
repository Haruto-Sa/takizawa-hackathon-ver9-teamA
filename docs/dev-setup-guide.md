# 開発セットアップガイド(Claude Code + Codex 併用)

ハッカソン初日の最初の1時間でこの手順を実行し、以降はエージェントに実装を任せる。
パッケージ管理はnpm、デプロイはGitHub Pagesに**完全統一**する(bun/Cloudflare等は混在させない)。

## 0. 前提条件

- Node.js LTS / npm
- **Docker Desktop**(`supabase functions serve` のローカル実行に必須)
- GitHubリポジトリ(Pages設定: GitHub Actions)
- Supabaseアカウント / OpenAI APIアカウント

## 1. リポジトリの初期化(人間が実行)

```bash
npx degit xyflow/vite-react-flow-template skilltree-app
cd skilltree-app
npm install

# 本体
npm install @xyflow/react @supabase/supabase-js zod react-router-dom @dagrejs/dagre motion
# 開発
npm install -D tailwindcss @tailwindcss/vite typescript
```

- `vite.config.ts` に Tailwind 4 のプラグインを追加:
  `import tailwindcss from '@tailwindcss/vite'` → `plugins: [react(), tailwindcss()]`
- `vite.config.ts` に `base: '/takizawa-hackathon-ver9-teamA/'` を設定。ルーティングはHashRouter
- package.json に `"typecheck": "tsc --noEmit"` と `"test"` スクリプトを追加
- **インストール完了後は package-lock.json をコミットし、以降は `npm ci` を使う**
  (「バージョン厳守」の正はlockファイル)

ルートに配置するファイル:
```
AGENTS.md / CLAUDE.md(@AGENTS.mdをインポート)/ .env.example / .gitignore(.env含む)
shared/schemas/tree.ts, quiz.ts(zodスキーマの唯一の正)
docs/skilltree_project_master_prompt.md   仕様書
docs/skilltree_baselines.md               ベースラインデータ(ツリー品質の核。必ず含める)
docs/api-contracts.md                     4関数の入出力契約(仕様書6節から転記して固定)
docs/acceptance-criteria.md               受け入れ基準9項目(仕様書6節から転記)
docs/demo-fixtures.md                     架空ペルソナ+固定デモツリー(フォールバック用)
docs/design.md                            デザイン仕様(デザイナーが記入: 色、ノードサイズ、
                                          状態別表示、モバイル表示、ローディング、エラー画面)
```

## 2. Supabase(人間が実行、15分)

```bash
npm install -g supabase
supabase init
supabase login
supabase link --project-ref <プロジェクトID>
supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=<モデルID>
```

- ダッシュボード: 匿名ログインを有効化
- **AI無料枠を使う場合の確認(毎回)**: OpenAIの設定ページ(data-controls/sharing)で
  対象モデルリストと資格を確認してから OPENAI_MODEL を設定。残高が正であることも確認。
  データ共有中は入出力がモデル改善に使われるため、**実名・連絡先・非公開成果物を送らない。
  デモは docs/demo-fixtures.md の架空ペルソナのみ使用**
- マイグレーションSQL(仕様書6節: 4テーブル+読み取り専用RLS)の適用はエージェントに任せてよい
- 注意: 匿名ユーザーはサインアウトやブラウザデータ削除後に復元不可・自動削除なし。
  審査デモのみなら対策不要だが、URLを一般公開するならTurnstile・回数制限・
  古い匿名ユーザーの削除を追加する

## 3. CI/CD(エージェントに生成させる)

- `.github/workflows/ci.yml`: PR/pushで `npm ci` → typecheck → test → build
- `.github/workflows/pages.yml`: **ciが成功した場合のみ** build成果物を
  `actions/upload-pages-artifact` → `actions/deploy-pages` でデプロイ

## 4. 活用するOSS一覧

| OSS | 用途 | 備考 |
|---|---|---|
| @xyflow/react v12 | ツリー描画 | Edgeは prerequisite_ids から生成 |
| @dagrejs/dagre | ツリー自動レイアウト | React Flow公式がツリー配置に推奨 |
| react-router-dom | ルーティング | HashRouter(Pages直リンク404回避) |
| zod | AI出力・API入出力の検証 | shared/schemas を両側からimport。Denoは `npm:zod` |
| @supabase/supabase-js | DB/Auth接続 | `signInAnonymously()` |
| Tailwind CSS 4 | スタイル | vite.config.tsに `tailwindcss()` 追加が必要 |
| motion | ノード開放アニメーション | 旧framer-motion |

## 5. エージェントの分担(コンフリクト回避)

- **Claude Code**: `/supabase` 全域(マイグレーション、Edge Functions 5本:
  generate-questions / generate-tree / get-or-generate-leaves / generate-quiz / grade-quiz)+ `src/lib/`
- **Codex**: `src/components/` `src/pages/`(オンボーディングUI、SkillTreePage 3状態、LeafDetailPanel、DailyLogForm、クイズモーダル)
- **共有物は `shared/schemas/` のみ**。変更時は必ず人間がレビューし、両エージェントに通知。
  コピーを作らず両側から直接importする(フロントはtsconfigのpaths、
  Edge Functionsは相対import。importが困難な場合のみコピーを許可し、CIで一致チェックを入れる)

## 6. エージェントへの最初の指示(コピペ用)

**Claude Codeへ(1回目):**
```
docs/skilltree_project_master_prompt.md と docs/api-contracts.md を読んで全体像を把握して。
その後、(1) 6節のDBスキーマ(7テーブル: profiles/trees/leaves/daily_logs/
leaf_generations/achievements/quiz_sessions + 最小権限RLS)をsupabase/migrationsに作成、
(2) shared/schemas/tree.ts と quiz.ts をzodで定義(木・枝・葉の3階層)、
(3) generate-questions / generate-tree / get-or-generate-leaves / generate-quiz /
grade-quiz の5本を実装して。get-or-generate-leavesは保存済みならAIを呼ばず、
request_hashで重複生成を防ぐこと。grade-quizはJWT検証・所有者照合・used_atによる
二重送信拒否・1トランザクション更新(枝done+木completed判定+unlocked伝播+achievement)を必ず入れて。
プランを先に見せて。
```

**Codexへ(1回目):**
```
AGENTS.mdと docs/skilltree_project_master_prompt.md の4節を読んで。
(1) オンボーディング4ステップのUI(12職種カード・拡張タグ・深掘り・学習条件)を
src/pages/Onboarding.tsx として実装。Step1-2,4は固定UI、Step3だけ generate-questions を呼ぶ。
(2) SkillTreePage.tsx を全体表示/木フォーカス/枝フォーカスの3状態で実装し、
fitViewでズーム、非関連ノードは薄表示。(3) LeafDetailPanel と DailyLogForm を実装。
APIは src/lib/api.ts に切り出し、未実装の間は docs/demo-fixtures.md のモックを返して。
実名を入力させる欄は作らないこと。
```

## 7. 完成度を上げる運用ルール

- エージェントの成果は必ず `npm run typecheck` と実際の画面確認を通す
- 動いた時点でコミット(細かく戻れる状態を保つ)
- 受け入れ基準(docs/acceptance-criteria.md の9項目)を完了の定義とし、
  終盤に全項目をチェックする。特に「Networkレスポンスに正解が含まれない」は
  DevToolsで実際に確認する
- ハマったら同じエージェントで粘らず、もう片方に同じ問題を見せて別解を出させる
- 残り時間25%になったら新機能を凍結し、デモ動線の磨き込みだけに切り替える