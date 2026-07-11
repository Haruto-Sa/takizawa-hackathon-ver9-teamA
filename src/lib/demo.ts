import type { SkillTree } from '../../shared/schemas/tree'

export const demoTree: SkillTree = {
  goal: 'フロントエンドエンジニア',
  milestones: [
    { id: 'm1', label: 'プログラミング基礎', status: 'current', nodes: [
      { id: 'variables', label: '変数と型', kind: 'normal', status: 'in_progress', prerequisite_ids: [], how_to_learn: 'JavaScriptでプロフィール情報を変数に格納し、型を確認してみよう。', evidence: null, related: [
        { id: 'variables-r1', label: 'TypeScript', note: '型を明示できるJSの拡張' },
        { id: 'variables-r2', label: 'DevTools Console', note: '値と型の確認に使う' },
      ] },
      { id: 'control', label: '制御構文', kind: 'normal', status: 'locked', prerequisite_ids: ['variables'], how_to_learn: '条件分岐を使った簡単な診断アプリを作ろう。', evidence: null, related: [
        { id: 'control-r1', label: 'アルゴリズム基礎', note: '処理の流れを設計する力' },
      ] },
      { id: 'functions', label: '関数', kind: 'normal', status: 'locked', prerequisite_ids: ['control'], how_to_learn: '繰り返す処理を関数として切り出してみよう。', evidence: null, related: [
        { id: 'functions-r1', label: 'クリーンコード', note: '読みやすい関数分割の指針' },
        { id: 'functions-r2', label: '単体テスト', note: '関数単位で動作を保証する' },
      ] },
      { id: 'hidden-1', label: '伝える力', kind: 'hidden', status: 'unlocked', prerequisite_ids: [], how_to_learn: '今日学んだことを3行で誰かに説明してみよう。', evidence: null, related: [] },
    ]},
    { id: 'm2', label: '開発の道具', status: 'upcoming', nodes: [] },
    { id: 'm3', label: 'Webの仕組み', status: 'locked', nodes: [] },
    { id: 'm4', label: 'JavaScript実践', status: 'locked', nodes: [] },
    { id: 'm5', label: 'ReactとUI実装', status: 'locked', nodes: [] },
  ],
}
