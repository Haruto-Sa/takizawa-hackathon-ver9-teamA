import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { ensureTreeV2, loadLeaves } from '../_shared/tree-adapter.ts'
import { buildCandidates } from '../_shared/candidates.ts'
import { contentHash, detectSecrets, maskSecrets, MAX_DIFF_CHARS, MAX_NOTE_CHARS, MAX_TEXT_CHARS } from '../_shared/artifact-sanitize.ts'
import { applyMatchesServer, tierMatches, validateAnalysisMatches, type ArtifactMatchInput } from '../_shared/progress.ts'
import { runGeneration } from '../_shared/generate.ts'
import * as artifactPrompt from '../_shared/prompts/analyze-artifact.ts'

type RawAnalysis = {
  summary: string
  matches: ArtifactMatchInput[]
  hidden_signals: Array<{ hidden_branch_id: string; confidence: number; reason: string }>
  warnings: string[]
}

Deno.serve(handler(async (req) => {
  try {
    const user = await requireUser(req)
    const body = await req.json()
    const sourceType = String(body.source_type ?? 'note')
    if (typeof body.tree_id !== 'string' || !['note', 'url', 'diff', 'file'].includes(sourceType)) return json({ error: 'invalid_input' }, 400)
    const maxChars = sourceType === 'diff' ? MAX_DIFF_CHARS : MAX_TEXT_CHARS
    const rawText = typeof body.text_content === 'string' ? body.text_content : ''
    const note = typeof body.note === 'string' ? body.note.slice(0, MAX_NOTE_CHARS) : ''
    if (rawText.length === 0 && note.length === 0) return json({ error: 'invalid_input' }, 400)
    if (rawText.length > maxChars) return json({ error: 'too_long' }, 400)

    const secrets = detectSecrets(`${note}\n${rawText}`)
    if (secrets.mustReject) return json({ error: 'secret_content', detail: '秘密鍵などの機密情報が含まれるため受け付けられません' }, 400)
    const sanitized = maskSecrets(rawText)
    const sanitizedNote = maskSecrets(note)

    const db = admin()
    const { data: row } = await db.from('trees').select('id, user_id, tree_data').eq('id', body.tree_id).eq('user_id', user.id).maybeSingle()
    if (!row) return json({ error: 'not_found' }, 404)
    const tree = await ensureTreeV2(db, row)
    const leaves = await loadLeaves(db, body.tree_id)
    const leavesByBranch = new Map<string, typeof leaves>()
    leaves.forEach((l) => leavesByBranch.set(l.branch_id, [...(leavesByBranch.get(l.branch_id) ?? []), l]))

    // 同一内容の二重反映防止(content_hash unique)
    const hash = await contentHash([sourceType, sanitizedNote, sanitized])
    const { data: submission, error: subError } = await db.from('artifact_submissions')
      .insert({ user_id: user.id, tree_id: body.tree_id, source_type: sourceType, title: typeof body.title === 'string' ? body.title.slice(0, 200) : null, note: sanitizedNote, text_content: sanitized, content_hash: hash })
      .select('id').single()
    if (subError) {
      const { data: prior } = await db.from('artifact_submissions').select('id, analysis_status').eq('user_id', user.id).eq('tree_id', body.tree_id).eq('content_hash', hash).maybeSingle()
      const { data: priorMatches } = await db.from('artifact_matches').select('*').eq('submission_id', prior?.id ?? '')
      return json({
        submission_id: prior?.id ?? null,
        duplicate: true,
        analysis: { summary: 'この内容は投稿済みです(進捗は再反映されません)。', matches: [], hidden_signals: [], warnings: [] },
        tree,
        updated_node_ids: [],
        revealed_branch_ids: [],
        needs_confirmation: (priorMatches ?? []).filter((m) => !m.applied && m.confirmed_by_user === null && Number(m.confidence) >= 0.6 && Number(m.confidence) < 0.85)
          .map((m) => ({ match_id: m.id, trunk_id: m.trunk_id, branch_id: m.branch_id, leaf_id: m.leaf_id ?? undefined, confidence: Number(m.confidence), progress_delta: m.progress_delta, completion_supported: m.completion_supported, reason: m.reason, tags: m.tags ?? [] })),
      })
    }

    const focusedBranchId = typeof body.focused_branch_id === 'string' ? body.focused_branch_id : undefined
    const candidates = buildCandidates(tree, leavesByBranch, { focusedBranchId, inputText: `${sanitizedNote}\n${sanitized}`, max: 30 })

    let analysis: RawAnalysis
    try {
      analysis = await runGeneration({
        db, userId: user.id, functionName: 'analyze-artifact', prompt: artifactPrompt,
        input: {
          goal: tree.goal.title,
          focused_branch: candidates.find((c) => c.branch_id === focusedBranchId && !c.leaf_id)?.label ?? '',
          candidates_json: JSON.stringify(candidates),
          source_type: sourceType,
          note: sanitizedNote,
          sanitized_content: sanitized.slice(0, 20_000),
        },
      }) as RawAnalysis
    } catch {
      await db.from('artifact_submissions').update({ analysis_status: 'failed' }).eq('id', submission.id)
      return json({ error: 'analysis_failed', submission_id: submission.id }, 502)
    }

    const { valid } = validateAnalysisMatches(analysis.matches ?? [], candidates, tree)
    const { auto, needsConfirm, recordOnly } = tierMatches(valid)
    const applied = applyMatchesServer(tree, leavesByBranch, auto, submission.id)

    const withIds = (list: ArtifactMatchInput[], isApplied: boolean) => list.map((m) => ({
      id: crypto.randomUUID(), submission_id: submission.id,
      trunk_id: m.trunk_id, branch_id: m.branch_id, leaf_id: m.leaf_id ?? '',
      confidence: m.confidence, progress_delta: m.progress_delta,
      completion_supported: m.completion_supported, reason: m.reason, tags: m.tags,
      applied: isApplied, confirmed_by_user: null,
    }))
    const autoRows = withIds(auto, true)
    const confirmRows = withIds(needsConfirm, false)
    const recordRows = withIds(recordOnly, false)

    const { data: fresh } = await db.from('trees').select('updated_at').eq('id', body.tree_id).single()
    const { error: txError } = await db.rpc('apply_progress_transaction', {
      p_user_id: user.id,
      p_tree_id: body.tree_id,
      p_expected_updated_at: fresh?.updated_at ?? null,
      p_tree_data: auto.length > 0 ? applied.tree : null,
      p_leaf_upserts: applied.leafUpserts,
      p_events: applied.events,
      p_submission_update: { id: submission.id, analysis_status: needsConfirm.length > 0 ? 'needs_confirmation' : 'analyzed' },
      p_matches: [...autoRows, ...confirmRows, ...recordRows],
    })
    if (txError) return json({ error: txError.message }, 409)

    return json({
      submission_id: submission.id,
      analysis: { ...analysis, matches: valid },
      tree: auto.length > 0 ? applied.tree : tree,
      updated_node_ids: applied.updatedNodeIds,
      revealed_branch_ids: [],
      needs_confirmation: confirmRows.map((r) => ({ match_id: r.id, trunk_id: r.trunk_id, branch_id: r.branch_id, leaf_id: r.leaf_id || undefined, confidence: r.confidence, progress_delta: r.progress_delta, completion_supported: r.completion_supported, reason: r.reason, tags: r.tags })),
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500)
  }
}))
