export const demoTree=(goal:string,interest:string)=>({goal,milestones:[
 {id:'m1',label:'プログラミング基礎',status:'current',nodes:[
  {id:'variables',label:'変数と型',kind:'normal',status:'in_progress',prerequisite_ids:[],how_to_learn:'JavaScriptで変数を宣言し、値と型を確認しよう。',evidence:null,related:[{id:'variables-r1',label:'TypeScript',note:'型を明示できるJSの拡張'}],leaves:[{id:'variables-l1',label:'let/constで宣言してみる',description:'Consoleで試す',status:'todo'},{id:'variables-l2',label:'typeofで型を確認',description:'値の種類を比べる',status:'todo'}]},
  {id:'control',label:'制御構文',kind:'normal',status:'locked',prerequisite_ids:['variables'],how_to_learn:'if文を使ったミニ診断を作ろう。',evidence:null,related:[{id:'control-r1',label:'アルゴリズム基礎',note:'処理の流れを設計する力'}],leaves:[{id:'control-l1',label:'if/elseで分岐を書く',description:'条件を変えて試す',status:'todo'},{id:'control-l2',label:'forで繰り返す',description:'1〜10を出力',status:'todo'}]},
  {id:'hidden-1',label:interest||'伝える力',kind:'hidden',status:'unlocked',prerequisite_ids:[],how_to_learn:'今日学んだことを3行で説明しよう。',evidence:null,related:[],leaves:[{id:'hidden-1-l1',label:'学びを3行で説明',description:'誰かに向けて書く',status:'todo'}]}]},
 {id:'m2',label:'開発の道具',status:'upcoming',nodes:[
  {id:'git-basic',label:'Git/GitHub基礎',kind:'normal',status:'locked',prerequisite_ids:['control'],how_to_learn:'コードをコミットしてGitHubに公開しよう。',evidence:null,related:[],leaves:[{id:'git-basic-l1',label:'初めてのcommit',description:'メッセージも書く',status:'todo'}]}]},
 {id:'m3',label:'Webの仕組み',status:'locked',nodes:[
  {id:'http',label:'HTTPとブラウザ',kind:'normal',status:'locked',prerequisite_ids:['git-basic'],how_to_learn:'開発者ツールでリクエストを観察しよう。',evidence:null,related:[],leaves:[{id:'http-l1',label:'Networkタブを観察',description:'ステータスコードを読む',status:'todo'}]}]},
 {id:'m4',label:'実践と資産化',status:'locked',nodes:[
  {id:'dom',label:'DOM操作',kind:'normal',status:'locked',prerequisite_ids:['http'],how_to_learn:'ボタンで表示が変わるUIを作ろう。',evidence:null,related:[],leaves:[{id:'dom-l1',label:'TODOリストを作る',description:'追加と削除を実装',status:'todo'}]}]}]})
