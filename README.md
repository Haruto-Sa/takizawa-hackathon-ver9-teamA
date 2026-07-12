# PorTree

目標から逆算した学習ルートをAIが生成し、日々の学びを「木・枝・葉」のスキルツリーとして可視化する、学生向けのキャリア・学習支援Webアプリです。

学ぶ内容を一覧にするだけでなく、クイズで理解を確認し、合格したスキルを検証済みの実績として記録します。AIやSupabaseが利用できない場合も、固定デモデータで主要な操作を確認できます。

## 現在実装されている機能

- 4ステップのオンボーディング
  - 目標職種または自由記述のゴール
  - 経験した言語・ツールと学習期間
  - AIが生成する追加質問
  - キャリア以外で伸ばしたい能力
- OpenAI Responses APIによるスキルツリー生成
- GoalとStartを起点としたv2スキルツリー
  - Trunk: 主要技術領域
  - Branch: 学習単元
  - Leaf: 具体的な学習ステップ
  - RelatedTech: 関連技術
- React Flowによるツリー表示
- 全体 → Trunk → Branch → Leafの段階的なフォーカス表示
- パンくず、カメラ移動、詳細パネル、進捗率表示
- 4択クイズによるBranchの習得確認
- 合格時のノード更新、次ノードの解放、実績記録
- AIによる学習状況の振り返り
- AI・Supabase障害時の固定デモフォールバック
- Supabase匿名認証、Postgres、RLS、Edge Functions
- GitHub ActionsによるCIとGitHub Pagesデプロイ

## ツリーの考え方

```text
Goal: 目標職種
  ↑
Trunk: 主要技術領域
  ├─ Branch: 学習単元
  │    ├─ Leaf: 今日取り組める行動
  │    └─ RelatedTech: 関連情報
  └─ Hidden / Side Quest
  ↑
Start: 現在地
```

Branchの状態は `done | in_progress | unlocked | locked` です。`done` は自己申告やAI生成では設定せず、クイズ合格後にサーバーだけが設定します。

## 技術スタック

### フロントエンド

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `@xyflow/react` v12
- Motion
- Zod

### バックエンド

- Supabase Auth（匿名ログイン）
- Supabase Postgres + RLS
- Supabase Edge Functions（Deno / TypeScript）
- OpenAI Responses API + Structured Outputs

### CI/CD

- GitHub Actions
- GitHub Pages

## セットアップ

### 1. 依存関係をインストール

```bash
npm ci
```

### 2. フロントエンド環境変数

`.env.example` を参考に `.env` を作成します。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`VITE_SUPABASE_ANON_KEY` は公開可能なAnon Keyです。Service Role KeyやOpenAI APIキーをフロントエンドの環境変数へ置かないでください。

Supabaseの設定がない場合、アプリは固定デモへフォールバックします。

### 3. 開発サーバーを起動

```bash
npm run dev
```

Viteが表示するローカルURLをブラウザで開いてください。

## Supabaseのセットアップ

Supabase CLIでプロジェクトへログイン・リンクしたうえで、AuthenticationのAnonymous Sign-insを有効にします。

### Secrets

OpenAIの認証情報はEdge FunctionsのSecretsとして設定します。

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=<model-id>
```

設定状況は次で確認できます。

```bash
supabase secrets list
```

### DB migration

```bash
supabase db push
```

主要テーブルは次のとおりです。

- `profiles`: オンボーディング情報
- `trees`: スキルツリー本体
- `quiz_sessions`: 正解・解説を含む非公開クイズセッション
- `achievements`: 検証済み実績
- `generation_logs`: AI生成ログ

### Edge Functions

```bash
supabase functions deploy generate-questions
supabase functions deploy generate-tree
supabase functions deploy generate-quiz
supabase functions deploy grade-quiz
supabase functions deploy summarize-activity
```

| Function | 役割 |
|---|---|
| `generate-questions` | オンボーディングの追加質問を生成 |
| `generate-tree` | Goalと現在地からスキルツリーを生成・保存 |
| `generate-quiz` | Branchの4択クイズを生成し、正解をサーバーへ保存 |
| `grade-quiz` | 採点、状態更新、次ノード解放、実績追加 |
| `summarize-activity` | 現在の習得状況と次の行動を要約 |

Docker DesktopはSupabaseをローカル実行するときに必要です。クラウドへのFunctionsデプロイ自体はDockerなしでも実行できます。

## セキュリティ

- OpenAI APIキーとSupabase Service Role Keyはフロントへ配置しない
- すべてのEdge FunctionでJWTを検証する
- Service Roleを使う処理でも、対象データの所有者を明示的に照合する
- `trees` と `achievements` はクライアントから読み取りのみ許可する
- `quiz_sessions` はクライアントから直接アクセスできない
- `generate-quiz` のレスポンスに正解と解説を含めない
- 同じ `quiz_id` の二重採点を `used_at` で拒否する
- 合格時のツリー更新、解放伝播、実績追加をDBトランザクションで処理する
- AI出力はZodで検証し、失敗時はリトライ後に固定データへフォールバックする
- 実名、連絡先、非公開成果物をAIへ送信しない

ブラウザのNetworkタブでは、`generate-quiz` のレスポンスが `quiz_id`、問題文、選択肢だけであることを確認してください。

## 品質確認

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

CIではpush・Pull Requestごとに次を実行します。

```text
npm ci → typecheck → test → build
```

## GitHub Pages

Viteのbaseは次のリポジトリ名に設定されています。

```text
/takizawa-hackathon-ver9-teamA/
```

GitHubリポジトリに次のActions VariablesまたはSecretsを設定してください。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`main` ブランチのCIが成功すると、`.github/workflows/pages.yml` がbuild成果物をGitHub Pagesへデプロイします。

## 主なディレクトリ

```text
src/
  components/          ツリーノード、詳細パネル、クイズ、振り返りUI
  hooks/               ツリー階層のナビゲーション
  lib/                 API、Supabase、レイアウト、変換・進捗ロジック
  pages/               オンボーディングとスキルツリー画面
shared/schemas/        フロントとサーバーで共有するZodスキーマ
supabase/
  functions/           Edge Functionsと共有AI・認証ロジック
  migrations/          DB、RLS、採点トランザクション
docs/                  仕様、API契約、デザイン、デモfixture
.github/workflows/     CIとGitHub Pagesデプロイ
```

## 仕様書

- [v2マスター仕様](docs/20260712/skill-tree-project-master-prompt-v2.md)
- [ベースライン](docs/skill-tree-baselines.md)
- [API契約](docs/api-contracts.md)
- [受け入れ基準](docs/acceptance-criteria.md)
- [デザイン仕様](docs/design.md)
- [デモfixture](docs/demo-fixtures.md)
- [開発セットアップガイド](docs/dev-setup-guide.md)

## 現時点の注意事項

- 旧ツリーデータは読み込み時にv2へ変換します
- AI生成やSupabase呼び出しに失敗した場合、デモデータへ自動的に切り替わります
- テストスクリプトは設定されていますが、自動テストケースは今後拡充する必要があります
- v2仕様にある日次活動入力、成果物・コード差分の自動分類、Leafの遅延生成は段階的な実装対象です
