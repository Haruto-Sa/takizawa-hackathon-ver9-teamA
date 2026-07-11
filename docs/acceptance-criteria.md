# 受け入れ基準

- [x] 匿名ログイン後にオンボーディングを完了できる
- [x] generate-tree失敗時に固定デモデータへフォールバックできる
- [x] prerequisite_idsからEdgeを描画する
- [x] generate-quizのレスポンスに正解・解説を含めない
- [x] treesとachievementsはRLSで読み取り専用
- [x] 合格時の更新とachievement追加が1トランザクション
- [x] used_atにより二重送信を拒否
- [x] CI成功後のみPagesへデプロイ
- [x] AI/Supabase障害時も固定デモで主要動線を実行できる

NetworkレスポンスとRLSの最終確認は、Supabaseマイグレーション適用・Functionsデプロイ後に実環境で行う。
