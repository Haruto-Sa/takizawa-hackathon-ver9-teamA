# スキルツリー型AIキャリア支援サービス — プロジェクト形成マスタープロンプト

このドキュメントは、AIコーディングツール(Claude Code等)にプロジェクトを構築させるための仕様書兼プロンプトである。上から順に読み、記載された技術構成・データ構造・プロンプト仕様に従って実装すること。

---

## 1. プロジェクト概要

### コンセプト

> 情報過多の中でキャリアに近づいている実感を持てない学生に、目標から逆算されたスキルツリーで「次の一歩」を1つに絞って提示する。学習の理解はAIが検証し、その記録はノードに自動で刻まれる。日々の学びを進めるだけで、迷いが消え、就活で提示できる検証済みの実績が資産として育っていく。

### 解決する課題

- **課題A(方向の迷い)**: 学生は学ぶべき選択肢が多すぎて、日々の処理に追われるだけでキャリアに近づいている実感が持てない
- **課題B(証明の欠如)**: 勉強はしているが、他人(採用担当・教員・自分自身)が判断できる形式のアウトプットとしてまとまっていない

### 設計原則

**すべての機能は「今日の学習を前に進める」ために作る。資産化はその副産物として自動で起きる。**

- クイズは「テスト」ではなく「ノードを開放する鍵」として演出する
- 実績(evidence)は自動記録。ユーザーにポートフォリオ整理の作業を要求しない
- タスク単位をスキルノード1個に絞り、マルチタスクを構造的に禁止する

### ターゲット

エンジニア・デザイナー志望を中心とした、これからキャリアを決定していく学生。

---

## 2. MVPスコープ(開発期間: 1〜2日 / 3人チーム)

### 実装するもの

1. オンボーディング(4ステップ入力: 12職種・拡張タグ・深掘り・学習条件)
2. スキルツリー(木+枝)の自動生成と可視化(ズームフォーカス型のゲーム風マップ)
3. 葉(毎日タスク)の遅延生成と日次記録(daily_logs)
4. 理解度クイズによる枝の開放(成長アクション)
5. 隠し枝(★)1個の埋め込み
6. Supabaseによるデータ永続化(RLS有効)

### 実装しないもの(発表で「展望」として語る)

- リポジトリ/ファイルの成果物AIレビュー(evidenceフィールドに将来格納)
- RAGによる経験の蒸留・検索
- ツリー共有・閲覧モード(就活提示用)
- 最先端技術に追従するツリーの自動アップデート
- 隠しミッションの本格的なゲーム化

---

## 3. スキルツリー設計

### 3.1 3階層モデルと生成ロジック

ツリーは**木(Trunk)→ 枝(Branch)→ 葉(Leaf)**の3階層で構成する。

| 階層 | 役割 | 粒度 | 例 |
|---|---|---|---|
| 木 | ゴールまでの主要技術領域 | 1〜3か月 | データベース、アルゴリズム、深層学習 |
| 枝 | 技術領域を分解した学習単元 | 約1週間 | SQL基礎、探索アルゴリズム、CNN |
| 葉 | 毎日実行する具体的な学習内容 | 15分〜1日 | SELECT文を試す、二分探索を実装する |

生成はハイブリッド型・遅延生成:

1. **初回(generate-tree)**: 目標から逆算した木を4〜6本と、各木の枝(2〜4本)、
   さらに**各枝に葉2〜4枚を同時に生成する**。マクロ層(木)は目標逆算、
   ミクロ層(枝)はベースライン骨格に準拠。葉はツリー上で枝の周りに表示される
2. **(将来)枝クリック時(get-or-generate-leaves)**: 約1週間分の毎日タスクへ葉を拡張生成。
   生成済みならDBから返し、AIを呼ばない。同じ入力・同じ枝は request_hash で重複生成しない

これによりAI利用は「初回1回+枝の初回クリック1回ずつ」に制限され、
出力トークン・待ち時間・無料枠消費を抑えつつ「進むと地図が開ける」演出が実現する。

### 3.2 ベースライン: IT系共通幹 + 職種分岐モデル

類似するIT系職種は共通の幹を共有し、途中から分岐する。**目標を途中で変更しても、共通幹の習得済みノードはそのまま引き継がれる**(この設計自体がプロダクトの売り)。

```
[IT共通幹]
  プログラミング基礎(変数と型 / 制御構文 / 関数 / オブジェクト指向 / エラーとデバッグ)
  → 開発の道具(Git・GitHub / コマンドライン / エディタ環境)
  → Webの仕組み(HTTP / ブラウザとサーバー / HTML・CSS基礎)
  ↓ ここから分岐
  ├─ [フロントエンドエンジニア]
  │    JavaScript深掘り → React等のフレームワーク → 状態管理 → UI実装
  │    → パフォーマンス/アクセシビリティ → ポートフォリオ制作
  ├─ [バックエンドエンジニア]
  │    サーバーサイド言語 → データベース(SQL) → API設計(REST)
  │    → 認証・セキュリティ基礎 → デプロイ/クラウド入門 → ポートフォリオ制作
  ├─ [AI/データ系エンジニア]
  │    Python → データ処理(pandas等) → 統計・機械学習基礎
  │    → モデル活用(API/LLM) → 小規模プロジェクト → ポートフォリオ制作
  └─ [UI/UXデザイナー(IT系)]
       デザイン原則(色・タイポグラフィ・レイアウト) → Figma
       → UXリサーチ基礎 → プロトタイピング → 実装者との協働(HTML/CSS)
       → ポートフォリオ制作
```

- このベースラインは roadmap.sh 等の広く使われる学習ロードマップを参考に、マイルストーン粒度で定義したもの。ハルシネーション対策として、ミクロ層生成時はこの骨格をプロンプトに埋め込み、AIには「骨格の範囲内での状態割り当てと個人枝の追加」だけを許可する
- MVPのデモではフロントエンドエンジニアとUI/UXデザイナーの2職種を優先実装する(チームで内容の質を検証できるため)

### 3.3 状態の定義(階層ごとに別の列挙型を使う)

**TrunkStatus**: `completed | current | upcoming | locked`
**BranchStatus**: `done | in_progress | unlocked | locked`
**LeafStatus**: `todo | doing | done | skipped`

| 枝の状態 | 意味 | 見た目 |
|---|---|---|
| `done` | 習得済み(**クイズ合格によるサーバー検証後のみ**) | 塗り実線 + ✓ |
| `in_progress` | 現在挑戦中 | 外側リング + 脈打つアニメーション |
| `unlocked` | 挑戦可能 | 破線 |
| `locked` | 未開放 | グレー破線(霧) |

**検証ポリシー(階層で分担する)**:
- **葉**: 毎日のタスクなので自己申告で完了してよい(daily_logsに記録が残る)。
  フロントから直接更新できる唯一の階層
- **枝**: `done` は grade-quiz 合格時にサーバーだけが設定する。
  クイズは葉ごとには行わず、**枝の完了判定時のみ**実施する
  (枝の全葉が done/skipped になる、またはユーザーが挑戦を選択した時に解禁)。
  AI生成時・自己申告で枝を done にしてはならない(自己申告は最大 `in_progress`)。
  これにより「枝のdoneは常に検証済み」というプロダクトの主張が守られる
- **木**: 配下の枝が全て done になったらサーバーが `completed` に設定する

**解放条件**: `prerequisite_ids` に含まれる全要素が done/completed になったら `unlocked`。
枝・木の遷移計算はすべてサーバー側(grade-quiz)で行う。

### 3.4 データ型(`shared/schemas/tree.ts` のzod定義が唯一の正)

```ts
type SkillTree = {
  id: string
  goal: string
  trunks: Trunk[]
}

type Trunk = {
  id: string
  label: string
  description: string
  status: 'completed' | 'current' | 'upcoming' | 'locked'
  prerequisite_ids: string[]
  branches: Branch[]
}

type Branch = {
  id: string
  trunk_id: string
  label: string
  description: string
  kind: 'normal' | 'hidden'      // hidden = キャリア外の隠し枝(★・差し色)
  estimated_days: number
  status: 'done' | 'in_progress' | 'unlocked' | 'locked'
  prerequisite_ids: string[]
  leaves_generated: boolean       // 葉が生成済みか(遅延生成の判定)
  evidence: { type: 'quiz' | 'artifact', passed_at: string, detail: object } | null
  related: RelatedTech[]          // 関連技術(0〜4件)。枝からさらに枝分かれ表示する
}

type RelatedTech = {
  id: string                      // 「{枝id}-r1」形式
  label: string
  note: string                    // なぜ関連するかの一言
}

type Leaf = {
  id: string
  branch_id: string
  label: string
  description: string
  estimated_minutes: number
  scheduled_date?: string
  status: 'todo' | 'doing' | 'done' | 'skipped'
  completion_condition: string    // 何をもって完了とするかの明文
}

type DailyLog = {
  id: string
  leaf_id: string
  user_id: string
  note: string
  studied_minutes: number
  completed: boolean
  recorded_at: string
}
```

- **保存方針**: 木と枝と葉は `trees.tree_data`(jsonb)に丸ごと保存(MVPでは正規化しない)。
  葉は枝の `leaves: { id, label, description, status }[]`(2〜4枚)として埋め込む。
  日次記録(daily_logs)や葉の独立テーブル化は更新頻度が上がった段階の将来スコープ
- **`prerequisite_ids` が依存関係の正**(解放判定に使う)。レイアウトは自作の中央幹レイアウト
  (`src/lib/treeLayout.ts`)で、依存エッジは描画せず並び順とロック表示で伝える
- 関連技術は枝の `related` に持ち、ツリー上では枝の外側へ小さなピルとして枝分かれ表示する。
  習得判定(クイズ・解放伝播)の対象にはしない
- 隠し要素は枝の `kind: "hidden"` で表す(専用フィールドを作らない)
- `evidence` はクイズ合格時にサーバーが設定し、将来の成果物レビューに拡張できる
- 葉の `completion_condition` と `description` が「やり方まで細かく提示」の実体

---

## 4. 画面構成とユーザーフロー

### 4.1 オンボーディング(4ステップ / 固定UI + AI1箇所)

1. **目標分野**: 職種カード選択+自由記述欄。2カテゴリ12職種:
   - エンジニア: フロントエンド / バックエンド / モバイルアプリ / AI・機械学習 /
     データサイエンティスト / クラウド・インフラ
   - デザイン: UIデザイナー / UXデザイナー / Webデザイナー / グラフィックデザイナー /
     プロダクトデザイナー / 3D・モーションデザイナー
2. **経験のある技術・ツール**: タグ選択+おおよその期間
   - 開発: HTML / CSS / JavaScript / TypeScript / React / Vue / Python / Java /
     Swift / Kotlin / Git / GitHub / SQL / Docker / AWS
   - デザイン: Figma / FigJam / Adobe XD / Photoshop / Illustrator / After Effects /
     Blender / Canva / ワイヤーフレーム / プロトタイピング / ユーザーインタビュー /
     ユーザビリティテスト / デザインシステム / タイポグラフィ / 色彩設計
3. **経験の深掘り(AI動的生成)**: Step1-2の回答をもとにAIが1〜2問生成。
   テンプレートはIT系/デザイン系で分ける:
   - IT系: 「これまでに作ったアプリやプログラムは?」「どの部分を自分で実装した?」
     「現在、一人でできる作業は?」
   - デザイン系: 「これまでに制作した画面や作品は?」「デザインを作る際の思考の順序は?」
     「フィードバックを受けて改善した経験は?」「見た目・使いやすさ・情報設計のどれが得意?」
4. **学習条件**(葉の生成精度を高める入力):
   1日に使える時間 / 週に取り組める日数 / 目標達成予定日 /
   学習スタイル(書籍中心・動画中心・実践中心)/
   目的(個人制作・資格・就職・授業)/
   キャリア以外で伸ばしたいこと1つ(→ 隠し枝 `kind: "hidden"` の種)

Step3以外は固定UIで実装し、AIの制御不能リスクを避ける。実名・連絡先の入力欄は設けない。

### 4.2 ツリー画面(ズームフォーカス型ナビゲーション)

`SkillTreePage.tsx` を**全体表示 / 木フォーカス / 枝フォーカス**の3状態で実装する。

```
ツリー全体画面(木と主要な枝のみ表示)
  ↓ 木をクリック
選択した木へズーム・中央配置(枝を詳細表示)
  ↓ 枝をクリック
枝へフォーカスし、周囲に葉を展開(初回はget-or-generate-leavesで生成)
  ↓ 葉をクリック
LeafDetailPanel: 今日のタスク詳細・完了条件・記録画面
  ↓ 保存して戻る → 枝フォーカスへ / ズームアウトで上の階層へ
```

- フォーカスはReact Flowの `fitView` / `fitBounds`(duration付き)で実装し、
  関連しないノードは薄く表示する(選択ノード+`parentTreeId`一致のみ強調)

```ts
const focusTree = (treeId: string) => {
  const relatedNodes = nodes.filter(
    node => node.id === treeId || node.data.parentTreeId === treeId,
  )
  reactFlow.fitView({ nodes: relatedNodes, duration: 500, padding: 0.25 })
}
```
- 単色(ティール系)+グレー。差し色(アンバー)は隠し枝★の1箇所のみ
- 枝の `done` が増えるほど画面がティールに染まっていく = 成長の可視化

### 4.3 葉と日次記録(毎日の学習ループ / AI不使用)

- LeafDetailPanel に `description`・`completion_condition` を表示し、
  DailyLogForm で「メモ・学習時間・完了チェック」を記録 → daily_logs にinsert、
  葉の status を更新(todo → doing → done / skipped)
- 葉は自己申告で完了できる唯一の階層。ここが「タスクを1つに絞って集中する」体験の本体
- 枝の全葉が done/skipped になったら、枝のクイズ挑戦を促すバナーを表示する

### 4.4 クイズモーダル(枝の完了判定 / 成長アクション)

- クイズは**枝単位でのみ**実施する(葉ごとには行わない)。
  `in_progress` / `unlocked` の枝で「挑戦する」→ generate-quiz が選択式クイズを1〜3問生成し、
  **quiz_id・問題文・選択肢のみ**をフロントに返す(正解と解説は quiz_sessions に保存)
- 回答を quiz_id と共に grade-quiz へ提出 → サーバーが採点。合格なら枝が `done` に遷移
  (グレー→ティールへ色が流れ込む + ✓スタンプの開放アニメーション)→
  `prerequisite_ids` を満たした隣接の枝・木が解放 → evidenceバッジが付く
- 不正解時は解説を返して再挑戦を促す。同一 quiz_id の二重送信は used_at で拒否する
- この連鎖がデモ最大の見せ場。アニメーションに工数を集中する

---

## 5. AIプロンプト仕様

すべてSupabase Edge Functions経由でAI APIを呼ぶ(APIキーをフロントに置かない)。
Edge Functionsは**5本**: `generate-questions`(5.2) / `generate-tree`(5.1) /
`get-or-generate-leaves`(5.4) / `generate-quiz`(5.3) /
`grade-quiz`(AI不使用。採点・状態遷移・記録のみ)。

### 5.1 ツリー生成プロンプト(骨子)— generate-tree(木と枝のみ)

```
あなたはキャリア支援のスキルツリー設計者である。
以下のベースライン骨格を絶対の軸とし、逸脱した枝を作らないこと。

[ベースライン骨格: 3.2の該当職種分を埋め込む]

ユーザー情報:
- 目標職種: {goal}
- 経験タグ: {tags}
- 深掘り回答: {details}
- 学習条件: {conditions}(1日の時間 / 週の日数 / 期限 / 学習スタイル / 目的)

タスク:
1. 目標から逆算した木(主要技術領域、粒度1〜3か月)を4〜6本生成する
2. 各木に枝(学習単元、粒度約1週間)を2〜4本生成する(ベースライン骨格に準拠)。
   current の木は3〜4本と厚めにし、current 以外の木の枝はすべて locked にする
3. 各枝に葉(1セッションでできる小タスク)を2〜4枚生成する
   (labelと進め方の一言description、idは「{枝id}-l1」形式)
4. 木の状態を completed以外(current / upcoming / locked)から、
   枝の状態を in_progress / unlocked / locked から割り当てる。
   done は絶対に割り当てない(doneはクイズ合格後にサーバーだけが設定する)。
   経験タグ・深掘り回答に根拠がある枝は in_progress または unlocked にする
5. 各木・枝に prerequisite_ids を必ず設定する(循環禁止)
6. キャリア外の興味から kind: "hidden" の隠し枝を1本だけ追加する
7. ユーザーの経験に固有の個人枝を木ごとに最大2本追加してよい
8. estimated_days は学習条件(1日の時間・週の日数)を反映して見積もる
9. 各枝に関連技術 related を0〜4件付与する(labelと一言note、idは「{枝id}-r1」形式)
10. 指定のJSONスキーマのみで出力する
```

プロンプト本文・JSONスキーマ・`prompt_version`・チューニング(temperature等)は
`supabase/functions/_shared/prompts/` のモジュールで管理し、AI呼び出しの入出力は
サーバー側で `generation_logs` テーブルに記録する。

### 5.2 深掘り質問プロンプト(骨子)— generate-questions(オンボーディングStep3)

```
ユーザーの目標は {goal}(カテゴリ: {IT系|デザイン系})、経験タグは {tags} である。
以下のテンプレートを参考に、スキルの実態を把握する追加質問を1〜2問、
短く答えやすい形で生成せよ。JSON配列で出力すること。

[テンプレート: 4.1 Step3 のIT系/デザイン系質問を埋め込む]
```

AI失敗時はテンプレートの質問をそのまま返す(フォールバック)。

### 5.3 クイズ生成プロンプト(骨子)— generate-quiz(枝単位)

```
枝「{branch_label}」(職種: {goal})の理解を検証する4択クイズを{n}問生成せよ。
この枝に含まれる葉の学習内容: {leaf_labels}
難易度は入門〜基礎。各問に正解インデックスと1行の解説を含め、指定JSONで出力すること。
```

生成結果の全体は quiz_sessions に保存し、フロントには
quiz_id・問題文・選択肢のみを返す(正解・解説は返さない)。

### 5.4 葉生成プロンプト(骨子)— get-or-generate-leaves(枝の初回クリック時)

```
枝「{branch_label}」({description})を学ぶための、毎日実行できる
具体的な学習タスク(葉)を約1週間分生成せよ。

ユーザーの学習条件: 1日{minutes}分 / 週{days}日 / 学習スタイル: {style} / 目的: {purpose}

各葉には以下を含めること:
- label: 動詞で終わる具体的なタスク(例: 二分探索を実装する)
- description: 進め方の説明1〜2文(学習スタイルに合わせた教材種別を提案)
- estimated_minutes: 1日の利用可能時間以内
- completion_condition: 何をもって完了とするかの明文(例: サンプル3問が解けたら完了)
指定のJSONスキーマのみで出力すること。
```

生成前にDBを検索し、保存済みの葉があればAIを呼ばず返す。
同一入力の重複生成は request_hash で防止する。

---

## 6. 技術構成

```
フロント: React 19 + Vite + @xyflow/react v12(React Flow。旧reactflowパッケージは使わない)
          Tailwind CSS 4を使う場合はCSSファースト設定
          (@import "tailwindcss" の後にglobal.cssで@xyflow/react/dist/style.cssを読み込む)
          ホスティング: GitHub Pages(静的サイト)
          ※ base設定とSPAルーティング404対策(ハッシュルーター推奨)に注意
          ※ Next.jsを使う場合はGitHub PagesではなくVercelに変更すること
        ↓
Supabase: Auth(匿名ログイン or マジックリンク)
          Postgres(RLS有効)
          Edge Functions(AI API呼び出しの中継・キー秘匿・JSON検証・採点)
        ↓
AI API: OpenAI Responses API + Structured Outputs(JSON Schema強制)
        ※ 新規実装はChat CompletionsではなくResponses APIを使う(OpenAIの推奨)
        ※ モデルIDは環境変数 OPENAI_MODEL で指定(Edge Functions内の1箇所)
        ※ 構造化出力でも refusal(拒否)・出力上限による不完全出力・タイムアウトは
          起こり得る。それぞれ個別にハンドリングし、失敗時は1回リトライ →
          それでも失敗なら固定デモデータへフォールバックする
```

### AI利用の運用事項(固定仕様ではなくセットアップ時に確認する)

- **日次無料トークン枠**(complimentary daily tokens)を使う場合、対象モデルと資格は
  変動するため、設定ページ(data-controls/sharing)で毎回確認して OPENAI_MODEL を設定する。
  無料枠の利用にはアカウント残高が正であることが必要。gpt-5.6-lunaは従量課金の切替先
- **プライバシー**: データ共有にオプトインしている間、APIの入出力はモデル改善に
  使用され得る。学生の本名・連絡先・非公開の成果物をAIに送信しない設計にすること。
  オンボーディングの入力項目にも実名欄を設けない。**デモは架空ペルソナのみを使用する**

### 補足: Edge Functionsの実装言語

Supabase Edge FunctionsはDenoランタイムで動くため**TypeScript(またはJavaScript)必須**。
Pythonは使えない。ただし書くコードは「AI APIへのfetch」「zodでのJSON検証」
「採点の比較処理」「DB更新」程度の小規模なもので、Python経験があれば読み書きは十分可能。
型注釈のあるJavaScriptと捉えてよい。実装の大部分はAIコーディングツールに生成させ、
人間はロジックのレビューに集中する。

### API契約(Edge Functions 5本 / 詳細は docs/api-contracts.md に固定する)

サーバー側が真実を持つ。Edge FunctionsはService Roleキーを使うためRLSを迂回する。
**全関数で必ずJWTを検証し、リクエストのuser_idと対象データの所有者を明示的に照合すること。**

1. **generate-questions**
   入力: goal, category, tags / 出力: 深掘り質問1〜2問の配列。
   AI失敗時はIT系/デザイン系の固定テンプレート質問にフォールバック
2. **generate-tree**
   入力: goal, tags, details, conditions, interests / 処理: AIが木+枝を生成(葉なし)→
   zodでスキーマ検証、不正なら1回だけ自動リトライ。ID重複・不正な状態値・
   prerequisite_idsの循環を正規化してから trees に保存 / 出力: ツリーJSON。
   失敗時は固定デモツリー(docs/demo-fixtures.md)にフォールバック
3. **get-or-generate-leaves**
   入力: tree_id, branch_id / 処理: leaves テーブルを検索し、保存済みならそのまま返す
   (AIを呼ばない)。未生成なら request_hash(user_id+branch_id+学習条件のハッシュ)で
   重複生成を防ぎつつAIが約1週間分の葉を生成 → zod検証 → leaves に保存し
   branch の leaves_generated を true に更新 / 出力: 葉の配列
4. **generate-quiz**(枝単位)
   入力: tree_id, branch_id / 処理: 枝と配下の葉の内容からAIがクイズ生成 →
   問題・選択肢・正解・解説の全体を quiz_sessions に保存(expires_at付き) /
   出力: quiz_id・問題文・選択肢のみ。**正解と解説をレスポンスに含めない**
5. **grade-quiz**(AI不使用)
   入力: quiz_id, answers / 処理: quiz_sessions から正解を取得して採点。
   used_at が非nullなら拒否(二重送信防止)。合格なら
   「tree_dataの枝をdoneに更新 + 配下の木のcompleted判定 +
   prerequisite_ids充足要素のunlocked伝播 + achievementsへの記録 + used_atの記録」を
   **1トランザクションで実行** / 出力: 採点結果・解説・更新後ツリー

**葉の完了記録はEdge Functionsを通さない**(AI不使用・低リスクのため):
フロントが daily_logs にinsertし、自分の leaves の status を直接更新する(RLSで許可)。

この構造により「枝のevidenceは改ざんできない検証済みの実績である」と主張できる。

### DBスキーマ

```sql
-- ユーザープロファイル
create table profiles (
  id uuid primary key references auth.users(id),
  goal text,
  interests jsonb,
  learning_conditions jsonb, -- 1日の時間 / 週の日数 / 期限 / スタイル / 目的
  created_at timestamptz default now()
);

-- スキルツリー本体(木+枝をjsonbで丸ごと保存。葉は含めない)
create table trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  goal text not null,
  tree_data jsonb not null,   -- trunks[](branches[]を含む)
  updated_at timestamptz default now()
);

-- 葉(毎日のタスク。更新頻度が高いため独立テーブル)
create table leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tree_id uuid references trees(id) not null,
  branch_id text not null,            -- tree_data内の枝ID
  label text not null,
  description text,
  estimated_minutes int,
  completion_condition text,
  scheduled_date date,
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done', 'skipped')),
  created_at timestamptz default now()
);

-- 日次記録
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  leaf_id uuid references leaves(id) not null,
  note text,
  studied_minutes int,
  completed boolean default false,
  recorded_at timestamptz default now()
);

-- 葉の重複生成防止(request_hash = user_id+branch_id+学習条件のハッシュ)
create table leaf_generations (
  request_hash text primary key,
  user_id uuid not null,
  branch_id text not null,
  created_at timestamptz default now()
);

-- 成長の記録(資産の実体。枝単位)
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  branch_id text not null,
  type text not null check (type in ('quiz', 'artifact')),
  detail jsonb,
  created_at timestamptz default now()
);

-- クイズの正解をサーバー側に保持するテーブル(フロントからは一切アクセス不可)
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tree_id uuid references trees(id) not null,
  branch_id text not null,
  questions_private jsonb not null, -- 問題・選択肢・正解・解説の全体
  expires_at timestamptz not null,
  used_at timestamptz,              -- 非nullなら採点済み(二重送信防止)
  created_at timestamptz default now()
);

-- RLS: フロントの権限は最小化する
alter table profiles enable row level security;
alter table trees enable row level security;
alter table leaves enable row level security;
alter table daily_logs enable row level security;
alter table leaf_generations enable row level security;
alter table achievements enable row level security;
alter table quiz_sessions enable row level security;

-- profiles: 自分の行の select / insert / update のみ
create policy "select own" on profiles for select using (id = auth.uid());
create policy "insert own" on profiles for insert with check (id = auth.uid());
create policy "update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- trees: 自分の行の select のみ(枝・木の書き換えはサーバーのみ)
create policy "select own" on trees for select using (user_id = auth.uid());

-- leaves: 自分の行の select と update(自己申告の完了)。insertはサーバーのみ
create policy "select own" on leaves for select using (user_id = auth.uid());
create policy "update own" on leaves for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- daily_logs: 自分の行の select / insert のみ
create policy "select own" on daily_logs for select using (user_id = auth.uid());
create policy "insert own" on daily_logs for insert with check (user_id = auth.uid());

-- achievements: 自分の行の select のみ(追加はサーバーのみ)
create policy "select own" on achievements for select using (user_id = auth.uid());

-- quiz_sessions / leaf_generations: フロントからのポリシーを一切作らない(=全操作拒否)
```

セキュリティ方針:
- フロントに許可するのは「profilesの自己管理」と「trees/achievementsの閲覧」だけ。
  ノード状態の変更・実績の追加は必ずEdge Functions経由(これがRLSで強制される)
- Edge FunctionsはService RoleキーでRLSを迂回するため、**JWT検証とuser_id照合を省略しない**
- 認証はSupabase Authの匿名ログインに委譲。ただし匿名ユーザーはブラウザデータ削除や
  サインアウト後に復元できず自動削除もされない点に注意。公開デモとして晒す場合は
  CAPTCHA(Turnstile)・呼び出し回数制限・古い匿名ユーザーの削除処理を検討する
  (ハッカソンの審査デモだけなら省略可)
- AI APIキーはEdge Functions内のみで保持

### 完成の定義(受け入れ基準 / 詳細は docs/acceptance-criteria.md に固定する)

1. 匿名ログイン後にオンボーディングを完了できる
2. generate-tree 失敗時に固定デモデータへフォールバックできる
3. ツリーの prerequisite_ids からEdgeを描画でき、木→枝→葉のズームフォーカスが動作する
4. 枝の2回目以降のクリックでは保存済みの葉が返り、AIを呼ばない(request_hashで重複生成しない)
5. 葉の完了操作で daily_logs に記録が残り、葉の status が更新される
6. 正解情報がブラウザやNetworkレスポンスに含まれない
7. フロントから trees と achievements を直接変更できない(RLSで拒否される)
8. クイズ合格時のツリー更新とachievement追加が1トランザクションで完了する
9. 同一クイズの二重送信で実績が重複しない
10. typecheck・テスト・ビルド成功後にのみPagesへデプロイされる
11. AI API障害時でも2分間のデモを完遂できる

---

## 7. デザインガイドライン

- ツリーは中央幹レイアウト×コスミックガラス: 下部のSTART円から縦の幹が伸び、マイルストーンのピルが幹上に並び、
  枝(ガラスバブル)は左右交互に分岐。葉は全体ビューでは緑の芽ドット、関連技術は小ピルで枝分かれ。
  枝をクリックすると葉・関連技術がその枝の周りへ円形に引き寄せられるフォーカスビューに遷移する
  (詳細は docs/design.md / docs/ui-structure.md)
- 差し色(アンバー)は隠し枝★の1箇所限定
- 枝の開放アニメーション: グレー→ティールに色が流れ込む + ✓スタンプ
- ズームフォーカス: 選択した木/枝へ `fitView`(duration付き)で滑らかに移動し、
  関連しない要素は薄く表示する。全体→木→枝→葉の階層感が「地図が開ける」体験の本体
- 実装コンポーネント: `SkillTreePage.tsx`(全体/木フォーカス/枝フォーカスの3状態)、
  `LeafDetailPanel`、`DailyLogForm`
- 詳細(ノードサイズ、状態別表示、モバイル表示、ローディング、エラー画面)は
  docs/design.md にデザイナーが定義する

---

## 8. チーム分担(3人 / 1〜2日)

| 担当 | タスク |
|---|---|
| Web経験者 | Supabaseセットアップ(Auth/DB/RLS)、Edge Functions 5本、React Flowでのズームフォーカス実装、状態遷移ロジック |
| デザイナー | ノード・枝・葉のデザイン、開放アニメーション、オンボーディングUI、docs/design.md |
| 初心者メンバー | ツリー/葉/クイズ生成プロンプトの作成と検証、職種分のベースライン整備、デモ用ペルソナと固定フィクスチャ作成、発表資料 |

### 推奨タイムライン

- **Day 1 午前**: Supabase構築 + React Flow素振り / デザインラフ確定 / プロンプト初版
- **Day 1 午後**: ツリー(木+枝)生成→描画の一気通貫 / ノードデザイン組み込み / プロンプト検証ループ
- **Day 2 午前**: 葉の遅延生成+日次記録 / クイズ→枝開放の連鎖+アニメーション / オンボーディングUI
- **Day 2 午後**: 隠し枝 / デモリハーサル / 発表資料仕上げ

---

## 9. デモ台本(2分)

1. **課題提起(20秒)**: 「学生は将来像に近づいている実感が持てない。学んだ証拠も残っていない」
2. **オンボーディング(30秒)**: 4ステップ入力(架空ペルソナ: AI・機械学習エンジニア志望・Python学習経験のある学生)
3. **ツリー生成(20秒)**: 目標から逆算された木と枝のマップが出現。木をクリックしてズーム
4. **毎日の学習(20秒)**: 枝をクリック→今日の葉が展開→1つ完了して記録が残る
5. **成長体験(20秒)**: 枝のクイズに正解 → 開放アニメーション → evidenceバッジ → 隣の枝が解放
6. **展望(10秒)**: 隠し枝★をチラ見せ。「このツリーは将来、就活で提示できる検証済みポートフォリオになる」

### ピッチの核となる一文

> 「学習の迷いを断つ地図であり、学んだ証明になるポートフォリオ。その両方を1つのスキルツリーで実現する」

### 差別化の主張

- 学習管理ツール(Notion等)は記録が手動で続かない。ポートフォリオサービスは完成した成果しか載らない。本プロダクトは**過程が自動で証明になる**
- ハルシネーション対策として「検証済みベースライン + AIパーソナライズ」の2層設計を採用
- IT系職種で幹を共有するため、目標変更時も習得済みスキルが資産として引き継がれる

---

## 10. 将来展望(発表用)

- 成果物レビュー: リポジトリ/ファイルをAIが解析し `evidence(type: artifact)` として自動記録
- RAGによる経験の蒸留: 蓄積されたachievementsから「どんな経験を積んだ人か」を検索・要約可能に
- ツリーの継続アップデート: 最先端技術の変化に合わせ、習得済みは維持しつつ新ノードを追加
- 隠しミッションの拡張: キャリア外スキルもメインと同様に進化し、発見の幸福を設計する
- 共有モード: 検証済みツリーをURLで採用担当に提示できる就活資産化