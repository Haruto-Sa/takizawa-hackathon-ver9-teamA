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

1. オンボーディング(4ステップ入力)
2. スキルツリーの自動生成と可視化(ゲーム風マップ)
3. 理解度クイズによるノード開放(成長アクション)
4. 隠しノード(★)1個の埋め込み
5. Supabaseによるデータ永続化(RLS有効)

### 実装しないもの(発表で「展望」として語る)

- リポジトリ/ファイルの成果物AIレビュー(evidenceフィールドに将来格納)
- RAGによる経験の蒸留・検索
- ツリー共有・閲覧モード(就活提示用)
- 最先端技術に追従するツリーの自動アップデート
- 隠しミッションの本格的なゲーム化

---

## 3. スキルツリー設計

### 3.1 生成ロジック(ハイブリッド型・2段階)

1. **マクロ層(目標逆算)**: ユーザーの目標職種から、到達までのマイルストーンを4〜6個、AIが逆引き生成する。粒度は粗くてよい
2. **ミクロ層(定番ルート)**: ユーザーの現在地に該当するマイルストーンのみを展開し、事前定義されたベースライン(下記3.2)に沿って詳細ノードを生成する。AIはベースラインを軸に、ユーザーの経験に応じて各ノードの状態を割り当て、個人枝を2〜3本追加する

全体を一度に生成しない。現在地周辺のみ詳細化することで、API負荷を下げつつ「進むと地図が開ける」演出を実現する。

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

### 3.3 状態の定義(NodeとMilestoneで別の列挙型を使う)

**NodeStatus(4値のみ)**: `done | in_progress | unlocked | locked`
**MilestoneStatus(4値のみ)**: `completed | current | upcoming | locked`

| ノード状態 | 意味 | 見た目 |
|---|---|---|
| `done` | 習得済み(**クイズ合格によるサーバー検証後のみ**) | 塗り実線 + ✓ |
| `in_progress` | 現在挑戦中 | 外側リング + 脈打つアニメーション |
| `unlocked` | 挑戦可能 | 破線 |
| `locked` | 未開放 | グレー破線(霧) |

**状態遷移のルール(明文化)**:
- `done` は grade-quiz 合格時にサーバーだけが設定する。オンボーディングの自己申告を
  根拠に `done` を割り当ててはならない(自己申告は最大 `in_progress` まで)。
  これにより「doneは常に検証済み」というプロダクトの主張が守られる
- 解放条件: `prerequisite_ids` に含まれる全ノードが `done` になったら `unlocked` /
  挑戦開始で `in_progress` / 合格で `done`
- 遷移の計算はすべて grade-quiz(サーバー側)で行う

### 3.4 ツリーのJSONスキーマ(`shared/schemas/tree.ts` のzod定義が唯一の正)

AIの構造化出力(JSON Schema強制)で以下の形式を出力させる。

```json
{
  "goal": "フロントエンドエンジニア",
  "milestones": [
    {
      "id": "m1",
      "label": "プログラミング基礎",
      "status": "current",
      "nodes": [
        {
          "id": "n1",
          "label": "変数と型",
          "kind": "normal",
          "status": "in_progress",
          "prerequisite_ids": [],
          "how_to_learn": "教材や進め方の短い提案",
          "evidence": null
        },
        {
          "id": "n2",
          "label": "関数",
          "kind": "normal",
          "status": "locked",
          "prerequisite_ids": ["n1"],
          "how_to_learn": "...",
          "evidence": null
        },
        {
          "id": "h1",
          "label": "(オンボーディングStep4の回答から生成)",
          "kind": "hidden",
          "status": "unlocked",
          "prerequisite_ids": [],
          "how_to_learn": "...",
          "evidence": null
        }
      ]
    },
    { "id": "m2", "label": "Web基礎", "status": "upcoming", "nodes": [] }
  ]
}
```

- **`prerequisite_ids` がノード間の依存関係の正**。React FlowのEdgeはこの配列から生成し、
  レイアウトはdagreに任せる(React Flow公式もツリー配置にDagreを推奨)
- 隠しノードは通常ノードと同一スキーマで `kind: "hidden"` により区別する
  (専用フィールドを作らない。描画時に★スタイルと差し色を適用するだけ)
- `evidence` は `{ "type": "quiz" | "artifact", "passed_at": "ISO8601", "detail": {} }`。
  クイズ合格時にサーバーが設定し、将来の成果物レビューに拡張できる
- `how_to_learn` が「やり方まで細かく提示」の実体。ノードクリックで表示する

---

## 4. 画面構成とユーザーフロー

### 4.1 オンボーディング(4ステップ / 固定UI + AI1箇所)

1. **目標**: 職種カード選択(フロントエンド / バックエンド / AI・データ / UIデザイナー)+ 自由記述欄
2. **現在地**: 学習経験のタグ選択(触ったことのある言語・ツール)+ おおよその期間
3. **深掘り(AI動的生成)**: Step1-2の回答をもとにAIが1〜2問だけ追加質問を生成(例:「Javaで何を作った?」)。回答は状態割り当ての精度向上に使う
4. **味付け**: 「キャリア以外で伸ばしたいこと」を1つ質問 → 隠しノードの種にする

Step3以外は固定UIで実装し、AIの制御不能リスクを避ける。

### 4.2 ツリー画面(メイン)

- ゲーム風スキルマップ。左に現在地マイルストーン(展開済み)、右に未開放マイルストーンと目標
- 単色(ティール系)+ グレーの2色構成。差し色(アンバー)は隠しノード★の1箇所のみ
- `done` が増えるほど画面がティール色に染まっていく = 成長の可視化
- ノードクリック → 詳細パネル(`how_to_learn` 表示 + 「挑戦する」ボタン)

### 4.3 クイズモーダル(成長アクション)

- `in_progress` / `unlocked` ノードで「挑戦する」→ generate-quiz が選択式クイズを1〜3問生成し、
  **quiz_id・問題文・選択肢のみ**をフロントに返す(正解と解説は quiz_sessions に保存)
- 回答を quiz_id と共に grade-quiz へ提出 → サーバーが採点。合格ならノードが `done` に遷移
  (グレー→ティールへ色が流れ込む + ✓スタンプの開放アニメーション)→
  `prerequisite_ids` を満たした隣接ノードが `unlocked` に → evidenceバッジが付く
- 不正解時は解説を返して再挑戦を促す。同一 quiz_id の二重送信は used_at で拒否する
- この連鎖がデモ最大の見せ場。アニメーションに工数を集中する

---

## 5. AIプロンプト仕様

すべてSupabase Edge Functions経由でAI APIを呼ぶ(APIキーをフロントに置かない)。
Edge Functionsは**4本**: `generate-questions`(5.2) / `generate-tree`(5.1) /
`generate-quiz`(5.3) / `grade-quiz`(AI不使用。採点・状態遷移・記録のみ)。

### 5.1 ツリー生成プロンプト(骨子)— generate-tree

```
あなたはキャリア支援のスキルツリー設計者である。
以下のベースライン骨格を絶対の軸とし、逸脱したノードを作らないこと。

[ベースライン骨格: 3.2の該当職種分を埋め込む]

ユーザー情報:
- 目標職種: {goal}
- 経験タグ: {tags}
- 深掘り回答: {details}

タスク:
1. 目標から逆算したマイルストーンを4〜6個生成する(ベースライン骨格に準拠)
2. ユーザーの現在地に該当するマイルストーンを1つ特定し、そのノードを展開する
3. 各ノードの状態を in_progress / unlocked / locked から割り当てる。
   done は絶対に割り当てない(doneはクイズ合格後にサーバーだけが設定する)。
   経験タグ・深掘り回答に根拠があるノードは in_progress または unlocked にする
4. 各ノードに prerequisite_ids(依存するノードIDの配列)を必ず設定する
5. ユーザーの経験に固有の個人枝を2〜3ノード追加してよい
6. how_to_learn には具体的で短い学習方法を書く
7. 指定のJSONスキーマのみで出力する
```

### 5.2 深掘り質問プロンプト(骨子)— generate-questions(オンボーディングStep3)

```
ユーザーの目標は {goal}、経験タグは {tags} である。
スキルの実態を把握するために最も有効な追加質問を1〜2問、
短く答えやすい形で生成せよ。JSON配列で出力すること。
```

### 5.3 クイズ生成プロンプト(骨子)— generate-quiz

```
スキルノード「{node_label}」(職種: {goal})の理解を検証する
4択クイズを{n}問生成せよ。難易度は入門〜基礎。
各問に正解インデックスと1行の解説を含め、指定JSONで出力すること。
```

生成結果の全体は quiz_sessions に保存し、フロントには
quiz_id・問題文・選択肢のみを返す(正解・解説は返さない)。

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

### API契約(Edge Functions 4本 / 詳細は docs/api-contracts.md に固定する)

サーバー側が真実を持つ。Edge FunctionsはService Roleキーを使うためRLSを迂回する。
**全関数で必ずJWTを検証し、リクエストのuser_idと対象データの所有者を明示的に照合すること。**

1. **generate-questions**
   入力: goal, tags / 出力: 深掘り質問1〜2問の配列。AI失敗時は固定質問にフォールバック
2. **generate-tree**
   入力: goal, tags, details, interests / 処理: AI出力をzodでスキーマ検証し、
   不正なら1回だけ自動リトライ。ID重複・不正な状態値・prerequisite_idsの循環を
   正規化してから trees に保存 / 出力: ツリーJSON。
   失敗時は固定デモツリー(docs/demo-fixtures.md)にフォールバック
3. **generate-quiz**
   入力: tree_id, node_id / 処理: AIがクイズ生成 → 問題・選択肢・正解・解説の全体を
   quiz_sessions に保存(expires_at付き) / 出力: quiz_id・問題文・選択肢のみ。
   **正解と解説をレスポンスに含めない**
4. **grade-quiz**(AI不使用)
   入力: quiz_id, answers / 処理: quiz_sessions から正解を取得して採点。
   used_at が非nullなら拒否(二重送信防止)。合格なら
   「tree_dataのノードをdoneに更新 + prerequisite_ids充足ノードのunlocked伝播 +
   achievementsへの記録 + used_atの記録」を**1トランザクションで実行** /
   出力: 採点結果・解説・更新後ツリー

この構造により「evidenceは改ざんできない検証済みの実績である」と主張できる。

### DBスキーマ

```sql
-- ユーザープロファイル
create table profiles (
  id uuid primary key references auth.users(id),
  goal text,
  interests jsonb,
  created_at timestamptz default now()
);

-- スキルツリー本体(jsonbで丸ごと保存)
create table trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tree_data jsonb not null,
  updated_at timestamptz default now()
);

-- 成長の記録(資産の実体)
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  node_id text not null,
  type text not null check (type in ('quiz', 'artifact')),
  detail jsonb,
  created_at timestamptz default now()
);

-- クイズの正解をサーバー側に保持するテーブル(フロントからは一切アクセス不可)
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tree_id uuid references trees(id) not null,
  node_id text not null,
  questions_private jsonb not null, -- 問題・選択肢・正解・解説の全体
  expires_at timestamptz not null,
  used_at timestamptz,              -- 非nullなら採点済み(二重送信防止)
  created_at timestamptz default now()
);

-- RLS: 書き込みはEdge Functions(Service Role)のみ。フロントの権限は最小化する
alter table profiles enable row level security;
alter table trees enable row level security;
alter table achievements enable row level security;
alter table quiz_sessions enable row level security;

-- profiles: 自分の行の select / insert / update のみ
create policy "select own" on profiles for select using (id = auth.uid());
create policy "insert own" on profiles for insert with check (id = auth.uid());
create policy "update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- trees: 自分の行の select のみ(書き換えはサーバーのみ)
create policy "select own" on trees for select using (user_id = auth.uid());

-- achievements: 自分の行の select のみ(追加はサーバーのみ)
create policy "select own" on achievements for select using (user_id = auth.uid());

-- quiz_sessions: フロントからのポリシーを一切作らない(=全操作拒否)
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
3. ツリーの prerequisite_ids からEdgeを描画できる
4. 正解情報がブラウザやNetworkレスポンスに含まれない
5. フロントから trees と achievements を直接変更できない(RLSで拒否される)
6. クイズ合格時のツリー更新とachievement追加が1トランザクションで完了する
7. 同一クイズの二重送信で実績が重複しない
8. typecheck・テスト・ビルド成功後にのみPagesへデプロイされる
9. AI API障害時でも2分間のデモを完遂できる

---

## 7. デザインガイドライン

- 単色系統(ティール)+ グレー。状態は色の濃淡と線スタイル(実線/破線/リング)で表現
- 差し色(アンバー)は隠しノード★の1箇所限定
- ノード開放アニメーション: グレー→ティールに色が流れ込む + ✓スタンプ
- 現在地マイルストーンのみ展開、先は霧の中(進むと地図が開ける演出)

---

## 8. チーム分担(3人 / 1〜2日)

| 担当 | タスク |
|---|---|
| Web経験者 | Supabaseセットアップ(Auth/DB/RLS)、Edge Function経由のAI呼び出し、React Flowでのツリー描画、状態遷移ロジック |
| デザイナー | ノードデザイン、開放アニメーション、オンボーディングUI、全体トーン |
| 初心者メンバー | ツリー生成/クイズ生成プロンプトの作成と検証、職種2つ分のベースライン整備、デモ用ペルソナ作成、発表資料 |

### 推奨タイムライン

- **Day 1 午前**: Supabase構築 + React Flow素振り / デザインラフ確定 / プロンプト初版
- **Day 1 午後**: ツリー生成→描画の一気通貫 / ノードデザイン組み込み / プロンプト検証ループ
- **Day 2 午前**: クイズ→ノード開放の連鎖 + アニメーション / オンボーディングUI
- **Day 2 午後**: 隠しノード / デモリハーサル / 発表資料仕上げ

---

## 9. デモ台本(2分)

1. **課題提起(20秒)**: 「学生は将来像に近づいている実感が持てない。学んだ証拠も残っていない」
2. **オンボーディング(30秒)**: 4ステップ入力(ペルソナ: フロントエンド志望・Java学習経験のある学生)
3. **ツリー生成(20秒)**: 目標から逆算されたマップが出現。経験に応じて一部が既に習得済み
4. **成長体験(40秒)**: クイズに正解 → ノード開放アニメーション → evidenceバッジ → 隣が解放
5. **展望(10秒)**: 隠しノード★をチラ見せ。「このツリーは将来、就活で提示できる検証済みポートフォリオになる」

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