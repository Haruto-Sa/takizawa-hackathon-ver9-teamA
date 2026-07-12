import type { SkillTree } from '../../shared/schemas/tree'

export const demoTree: SkillTree = {
  goal: 'フロントエンドエンジニア',
  milestones: [
    { id: 'm1', label: 'プログラミング基礎', status: 'current', nodes: [
      { id: 'variables', label: '変数と型', kind: 'normal', status: 'in_progress', prerequisite_ids: [], how_to_learn: 'JavaScriptでプロフィール情報を変数に格納し、型を確認してみよう。', evidence: null, related: [
        { id: 'variables-r1', label: 'TypeScript', note: '型を明示できるJSの拡張' },
      ], leaves: [
        { id: 'variables-l1', label: 'let/constで宣言してみる', description: 'ブラウザのConsoleで試す', status: 'todo' },
        { id: 'variables-l2', label: 'typeofで型を確認', description: '数値・文字列・真偽値を比べる', status: 'todo' },
        { id: 'variables-l3', label: 'プロフィールを変数化', description: '名前・年齢・趣味を格納', status: 'todo' },
      ] },
      { id: 'control', label: '制御構文', kind: 'normal', status: 'locked', prerequisite_ids: ['variables'], how_to_learn: '条件分岐を使った簡単な診断アプリを作ろう。', evidence: null, related: [
        { id: 'control-r1', label: 'アルゴリズム基礎', note: '処理の流れを設計する力' },
      ], leaves: [
        { id: 'control-l1', label: 'if/elseで分岐を書く', description: '年齢で出し分けてみる', status: 'todo' },
        { id: 'control-l2', label: 'forで繰り返す', description: '1〜10を出力する', status: 'todo' },
      ] },
      { id: 'functions', label: '関数', kind: 'normal', status: 'locked', prerequisite_ids: ['control'], how_to_learn: '繰り返す処理を関数として切り出してみよう。', evidence: null, related: [
        { id: 'functions-r1', label: '単体テスト', note: '関数単位で動作を保証する' },
      ], leaves: [
        { id: 'functions-l1', label: '挨拶を返す関数を作る', description: '引数と戻り値を使う', status: 'todo' },
        { id: 'functions-l2', label: 'アロー関数に書き換える', description: '書き方の違いを比べる', status: 'todo' },
      ] },
      { id: 'hidden-1', label: '伝える力', kind: 'hidden', status: 'unlocked', prerequisite_ids: [], how_to_learn: '今日学んだことを3行で誰かに説明してみよう。', evidence: null, related: [], leaves: [
        { id: 'hidden-1-l1', label: '学びを3行で説明', description: '友達やSNSに向けて書く', status: 'todo' },
      ] },
    ]},
    { id: 'm2', label: '開発の道具', status: 'upcoming', nodes: [
      { id: 'git-basic', label: 'Git/GitHub基礎', kind: 'normal', status: 'locked', prerequisite_ids: ['functions'], how_to_learn: '自分のコードをコミットしてGitHubに公開しよう。', evidence: null, related: [
        { id: 'git-basic-r1', label: 'GitHub Actions', note: '自動化の入り口' },
      ], leaves: [
        { id: 'git-basic-l1', label: '初めてのcommit', description: 'メッセージの書き方も学ぶ', status: 'todo' },
        { id: 'git-basic-l2', label: 'リポジトリをpush', description: 'GitHubに公開してみる', status: 'todo' },
      ] },
      { id: 'editor', label: 'エディタ活用', kind: 'normal', status: 'locked', prerequisite_ids: ['git-basic'], how_to_learn: 'VS Codeのショートカットと拡張機能に慣れよう。', evidence: null, related: [], leaves: [
        { id: 'editor-l1', label: 'ショートカット5個習得', description: '検索・置換・複数カーソル', status: 'todo' },
      ] },
    ]},
    { id: 'm3', label: 'Webの仕組み', status: 'locked', nodes: [
      { id: 'http', label: 'HTTPとブラウザ', kind: 'normal', status: 'locked', prerequisite_ids: ['editor'], how_to_learn: '開発者ツールでリクエストの流れを観察しよう。', evidence: null, related: [
        { id: 'http-r1', label: 'REST API', note: 'Web APIの基本設計' },
      ], leaves: [
        { id: 'http-l1', label: 'Networkタブを観察', description: 'ステータスコードを読む', status: 'todo' },
        { id: 'http-l2', label: 'fetchでAPIを叩く', description: '天気APIなどで試す', status: 'todo' },
      ] },
      { id: 'htmlcss', label: 'HTML/CSS基礎', kind: 'normal', status: 'locked', prerequisite_ids: ['http'], how_to_learn: '自己紹介ページを1枚作ってみよう。', evidence: null, related: [], leaves: [
        { id: 'htmlcss-l1', label: '自己紹介ページ作成', description: '見出し・画像・リンクを使う', status: 'todo' },
      ] },
    ]},
    { id: 'm4', label: 'JavaScript実践', status: 'locked', nodes: [
      { id: 'dom', label: 'DOM操作', kind: 'normal', status: 'locked', prerequisite_ids: ['htmlcss'], how_to_learn: 'ボタンで表示が変わるTODOリストを作ろう。', evidence: null, related: [
        { id: 'dom-r1', label: 'イベント設計', note: 'ユーザー操作の受け取り方' },
      ], leaves: [
        { id: 'dom-l1', label: 'ボタンで文字を変える', description: 'addEventListenerを使う', status: 'todo' },
        { id: 'dom-l2', label: 'TODOリストを作る', description: '追加と削除を実装', status: 'todo' },
      ] },
    ]},
    { id: 'm5', label: 'ReactとUI実装', status: 'locked', nodes: [
      { id: 'react-basic', label: 'React基礎', kind: 'normal', status: 'locked', prerequisite_ids: ['dom'], how_to_learn: 'コンポーネントとstateで小さなUIを組み立てよう。', evidence: null, related: [
        { id: 'react-basic-r1', label: 'Vite', note: '開発環境の定番ツール' },
      ], leaves: [
        { id: 'react-basic-l1', label: 'カウンターを作る', description: 'useStateの基本', status: 'todo' },
        { id: 'react-basic-l2', label: 'propsで部品化', description: 'カードコンポーネント化', status: 'todo' },
      ] },
    ]},
  ],
}
