import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { generateStructured, withRetry } from './openai.ts'
import { tuning } from './prompts/tuning.ts'

type PromptModule<I> = {
  promptVersion: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  system: string
  buildPrompt: (input: I) => string
}

// AI生成の共通入口。成功・失敗を問わず入出力を console と generation_logs に記録し、
// エラーは呼び出し元へ再throwする(既存のデモフォールバックがそのまま働く)。
export async function runGeneration<I>({ db, userId, functionName, prompt, input }: {
  db: SupabaseClient
  userId: string | null
  functionName: string
  prompt: PromptModule<I>
  input: I
}): Promise<unknown> {
  const started = Date.now()
  let output: unknown = null
  let errorMessage: string | null = null
  try {
    output = await withRetry(() => generateStructured(prompt.buildPrompt(input), prompt.schemaName, prompt.jsonSchema, { system: prompt.system, temperature: tuning.temperature }))
    return output
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    const entry = {
      user_id: userId,
      function_name: functionName,
      prompt_version: prompt.promptVersion,
      model: Deno.env.get('OPENAI_MODEL') ?? null,
      input,
      raw_output: output,
      parsed_ok: errorMessage === null,
      error: errorMessage,
      latency_ms: Date.now() - started,
    }
    console.log(JSON.stringify({ generation_log: entry }))
    try {
      const { error } = await db.from('generation_logs').insert(entry)
      if (error) console.error('generation_log_insert_failed', error.message)
    } catch (logError) {
      console.error('generation_log_insert_failed', logError)
    }
  }
}
