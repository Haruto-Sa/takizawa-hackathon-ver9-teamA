// AI呼び出しの動作チューニング。モデル名は環境変数 OPENAI_MODEL で指定する。
export const tuning = {
  // 一部モデルはResponses APIでtemperatureを受け付けないため、undefinedのときは送らない
  temperature: undefined as number | undefined,
  timeoutMs: 45_000, // 全マイルストーン+葉の生成で出力が大きいため長め
  maxAttempts: 2,
}
