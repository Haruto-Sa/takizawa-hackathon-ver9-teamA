# dev-sasaki 実装差分分析と移行方針

対象リポジトリ: `Haruto-Sa/takizawa-hackathon-ver9-teamA`  
対象ブランチ: `dev-sasaki`  
基準日: 2026-07-12

## 1. 結論

要求しているアプリは、現在の技術構成を変更せずに実現できる。

- フロント: React + Vite + React Flow
- バックエンド: Supabase Auth / Postgres / Storage / Edge Functions
- AI: Edge Functions 経由の Structured Outputs
- ホスティング: GitHub Pages

ただし、現状に対する小規模な見た目修正だけでは足りない。特に次の3点は構造変更が必要である。

1. 画面状態を「全体 → 木 → 枝 → 葉」の4段階として明示する
2. `milestones / nodes / leaves` を、プロダクト上の `Trunk / Branch / Leaf` に対応づける
3. 成果物・差分・学習記録をAIが分類し、進捗イベントとして安全に反映する仕組みを追加する

## 2. 現在できていること

| 項目 | 状態 | 現状 |
|---|---|---|
| STARTからGoalへ伸びる中央幹 | 実装済み | `treeLayout.ts` で中央のspineを生成 |
| 主要スキルを左右交互に配置 | 実装済み | `SkillNode` を幹から左右に配置 |
| 枝クリックによるズーム | 部分実装 | skillノードのみフォーカス可能 |
| 葉の周辺展開 | 実装済み | 選択ノードの周囲へ円形配置 |
| 関係ないノードのフェード | 実装済み | opacity 0.07 |
| 隠しスキル表示 | 部分実装 | `kind: hidden` と★表示のみ |
| クイズによる習得判定 | 実装済み | 正解をサーバー側に保持しRPCで更新 |
| Supabase障害時のデモ | 実装済み | 固定デモツリーへフォールバック |
| AIによる振り返り | 実装済み | `summarize-activity` |
| 日次記録 | 未実装 | DB・画面ともに未接続 |
| 成果物・diffのAI分類 | 未実装 | `artifact` 型は定義だけ存在 |
| 葉ごとの進捗保存 | 未実装 | 葉はtree JSON内、`todo/done`のみ |
| 木クリック→木フォーカス | 未実装 | trunkノードのクリック処理がない |
| 葉クリック→入力・詳細 | 未実装 | LeafNodeは表示のみ |
| 派生タスクから隠しスキル解放 | 未実装 | `related` は表示専用 |
| 全画面のフェード遷移 | 部分実装 | React Flowのカメラ移動のみ |

## 3. 構想との主な差異

### 3.1 用語と階層

現在は次の対応になっている。

| 現在のコード | 構想上の意味 |
|---|---|
| `SkillTree.goal` | Goal |
| STARTノード | Start |
| `milestones[]` | 木・主要技術領域 |
| `milestone.nodes[]` | 枝・学習単元 |
| `node.leaves[]` | 葉・日次タスク |
| `node.related[]` | 関連情報。進捗対象ではない |

構造は近いが、コード上の命名と画面操作が構想と一致していない。  
短期的にはアダプタで対応できるが、継続開発では `trunks / branches / leaves` へ移行する。

### 3.2 フォーカス状態

現在は `focus: string | null` の2状態であり、木と葉を独立した画面状態として扱えない。  
次の状態機械へ変更する。

```ts
type TreeViewState =
  | { mode: 'overview' }
  | { mode: 'trunk'; trunkId: string }
  | { mode: 'branch'; trunkId: string; branchId: string }
  | { mode: 'leaf'; trunkId: string; branchId: string; leafId: string }
```

### 3.3 サブタスクと隠しスキル

現在の `related` は補足技術であり、完了状態・証拠・前提条件を持たない。  
進捗対象のサブタスクは `Branch.kind = side_quest` として通常枝と同じデータ構造を使用する。  
隠しスキルは `Branch.kind = hidden` とし、初期状態では `revealed = false` とする。

### 3.4 AIによる成果物判定

AIはツリーを直接書き換えない。次の順序で処理する。

1. ユーザーがメモ、コード差分、ファイルを送信
2. Edge Functionが入力を検証し、候補となる枝・葉だけをAIへ渡す
3. AIが該当ノード、確信度、進捗量、根拠をJSONで返す
4. サーバーが存在するノードIDか検証
5. `progress_events` と `artifact_matches` に記録
6. 確信度に応じて自動反映またはユーザー確認
7. フロントへ `updated_node_ids` を返し、該当ノードを発光

AIの1回の判定だけで枝を `done` にしない。枝の完了はクイズ合格、または複数の検証済み成果物によるサーバー判定とする。

## 4. 推奨する実装順

### Phase 1: 画面と用語の整合

- `TreeViewState` を導入
- trunkクリックを追加
- branchクリック時だけ葉を展開
- leafクリックで `LeafDetailPanel` を開く
- パンくず「全体 / 木 / 枝 / 葉」を追加
- Motionの `AnimatePresence` でパネルをフェード
- クイズ合格後はローカルで推測更新せず、サーバーが返すtreeを採用

### Phase 2: 日次記録

- `leaves` と `daily_logs` を独立テーブル化
- 葉に `doing / skipped`、所要時間、完了条件、進捗率を追加
- 1日分のメモ、時間、成果物リンクを記録
- 葉更新後に枝の進捗率を再計算

### Phase 3: 成果物の自動分類

- private Storage bucket `artifacts`
- `artifact_submissions`
- `artifact_matches`
- `progress_events`
- Edge Function `analyze-artifact`
- テキスト、Markdown、コード、diff、patchを優先対応
- AI判定後に該当ノードを2〜3秒発光

### Phase 4: サブタスク・隠しスキル

- `side_quest` を通常の進捗ノードとして追加
- 複数条件によるhidden branch解放
- 解放前は非表示または「???」
- 解放時に幹から新しい枝が伸びる演出

## 5. 変更対象ファイル

| ファイル | 主な変更 |
|---|---|
| `shared/schemas/tree.ts` | schema_version 2、Trunk/Branch/Leaf、progress追加 |
| `src/pages/SkillTreePage.tsx` | 4段階の画面状態、サーバーtree採用 |
| `src/lib/treeLayout.ts` | viewState別レイアウト、派生枝、隠し枝 |
| `src/components/treeNodes.tsx` | Leafクリック、発光、revealed状態 |
| `src/components/LeafDetailPanel.tsx` | 新規。日次記録と成果物入力 |
| `src/components/ArtifactInputPanel.tsx` | 新規。メモ、diff、ファイル |
| `src/lib/api.ts` | leaves、logs、analyze-artifact API |
| `supabase/migrations/*` | leaves、logs、artifacts、progress events |
| `supabase/functions/analyze-artifact/index.ts` | 新規。AI分類 |
| `supabase/functions/get-or-generate-leaves/index.ts` | 新規。葉の遅延生成 |
| `docs/api-contracts.md` | 新規API契約を追加 |
| `docs/acceptance-criteria.md` | 階層操作・自動判定・発光を追加 |

## 6. 重要な修正点

### クイズ合格後の状態

現状の画面はクイズ合格後にフロント側でtreeを推測更新している。  
RPCの戻り値に含まれる更新後treeをそのまま `setTree()` するか、DBから再取得する。

### 葉の生成方針

既存仕様には「初回に葉も生成」と「generate-treeは葉なし」が混在している。  
以下に統一する。

- `generate-tree`: 木と枝のみ生成
- `get-or-generate-leaves`: 枝の初回フォーカス時に5〜7件生成
- 全体画面の芽は未生成状態でもプレースホルダー表示可能
- 2回目以降はDBから返し、AIを呼ばない

### relatedとside questの分離

- `related`: 説明だけの関連技術
- `side_quest`: 完了可能な派生タスク
- `hidden`: 条件を満たすまで存在を隠す派生スキル

この3つを混同しない。

## 7. 完了判定

要求に合致したと判断できる最低条件は次の通り。

- 全体→木→枝→葉の順にクリックして移動できる
- 各遷移にカメラ移動とフェードがある
- 葉に日次メモと成果物を登録できる
- AIが入力を既存ノードへ分類し、根拠と確信度を返す
- 判定結果がDBへ記録される
- 該当ノードが一時的に発光する
- サブタスクが進捗対象として保存される
- 条件達成時に隠しスキルが幹から派生して表示される
- AIが不正なノードIDや状態値を返してもサーバーが拒否する
- APIキー、非公開成果物、クイズ正解がブラウザへ漏れない
