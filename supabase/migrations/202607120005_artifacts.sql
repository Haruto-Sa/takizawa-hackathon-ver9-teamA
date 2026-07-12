-- 成果物投稿とAI分類(v2 §9.5-9.6)。ファイルはMVPではテキスト抽出して送信するため
-- Storageバケットは後続対応(docs参照)。

create table public.artifact_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  source_type text not null
    check (source_type in ('note','url','diff','file')),
  title text,
  note text,
  text_content text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  content_hash text not null,
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending','analyzed','failed','needs_confirmation')),
  created_at timestamptz not null default now(),
  unique(user_id, tree_id, content_hash)
);

create table public.artifact_matches (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.artifact_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  trunk_id text not null,
  branch_id text not null,
  leaf_id text,
  confidence numeric not null check (confidence between 0 and 1),
  progress_delta int not null check (progress_delta between 0 and 30),
  completion_supported boolean not null default false,
  reason text not null,
  tags jsonb not null default '[]',
  applied boolean not null default false,
  confirmed_by_user boolean,
  created_at timestamptz not null default now()
);

alter table public.artifact_submissions enable row level security;
alter table public.artifact_matches enable row level security;
create policy "submissions select own" on public.artifact_submissions for select to authenticated using (user_id = auth.uid());
create policy "matches select own" on public.artifact_matches for select to authenticated using (user_id = auth.uid());
-- 書き込みはEdge Function(service_role)のみ

-- apply_progress_transaction を成果物対応に拡張(旧8引数版は削除して置き換え)
drop function if exists public.apply_progress_transaction(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb);
create or replace function public.apply_progress_transaction(
  p_user_id uuid,
  p_tree_id uuid,
  p_expected_updated_at timestamptz,
  p_tree_data jsonb,
  p_leaf_upserts jsonb default '[]'::jsonb,
  p_daily_log jsonb default null,
  p_events jsonb default '[]'::jsonb,
  p_achievements jsonb default '[]'::jsonb,
  p_submission_update jsonb default null,
  p_matches jsonb default '[]'::jsonb,
  p_match_updates jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare t trees%rowtype; v_log_id uuid; l jsonb; e jsonb; a jsonb; m jsonb; v_now timestamptz := now();
begin
  select * into t from trees where id = p_tree_id and user_id = p_user_id for update;
  if not found then raise exception 'tree_not_found'; end if;
  if p_expected_updated_at is not null and t.updated_at <> p_expected_updated_at then
    raise exception 'stale_tree';
  end if;

  for l in select * from jsonb_array_elements(coalesce(p_leaf_upserts, '[]'::jsonb)) loop
    insert into leaves(id, user_id, tree_id, branch_id, label, description, completion_condition, estimated_minutes, scheduled_date, status, progress, evidence_count, recently_updated_at, updated_at)
    values (
      l->>'id', p_user_id, p_tree_id, l->>'branch_id', l->>'label',
      coalesce(l->>'description',''), coalesce(l->>'completion_condition',''),
      coalesce((l->>'estimated_minutes')::int, 30), (l->>'scheduled_date')::date,
      coalesce(l->>'status','todo'), coalesce((l->>'progress')::int, 0),
      coalesce((l->>'evidence_count')::int, 0), v_now, v_now
    )
    on conflict (tree_id, id) do update set
      label = excluded.label,
      description = excluded.description,
      completion_condition = excluded.completion_condition,
      estimated_minutes = excluded.estimated_minutes,
      scheduled_date = excluded.scheduled_date,
      status = excluded.status,
      progress = excluded.progress,
      evidence_count = excluded.evidence_count,
      recently_updated_at = v_now,
      updated_at = v_now;
  end loop;

  if p_daily_log is not null then
    insert into daily_logs(user_id, tree_id, leaf_id, branch_id, note, studied_minutes, completed)
    values (
      p_user_id, p_tree_id, p_daily_log->>'leaf_id', p_daily_log->>'branch_id',
      p_daily_log->>'note', coalesce((p_daily_log->>'studied_minutes')::int, 0),
      coalesce((p_daily_log->>'completed')::boolean, false)
    ) returning id into v_log_id;
  end if;

  if p_submission_update is not null then
    update artifact_submissions set analysis_status = p_submission_update->>'analysis_status'
      where id = (p_submission_update->>'id')::uuid and user_id = p_user_id;
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_matches, '[]'::jsonb)) loop
    insert into artifact_matches(id, submission_id, user_id, tree_id, trunk_id, branch_id, leaf_id, confidence, progress_delta, completion_supported, reason, tags, applied, confirmed_by_user)
    values (
      coalesce((m->>'id')::uuid, gen_random_uuid()),
      (m->>'submission_id')::uuid, p_user_id, p_tree_id,
      m->>'trunk_id', m->>'branch_id', nullif(m->>'leaf_id',''),
      (m->>'confidence')::numeric, coalesce((m->>'progress_delta')::int, 0),
      coalesce((m->>'completion_supported')::boolean, false),
      coalesce(m->>'reason',''), coalesce(m->'tags','[]'::jsonb),
      coalesce((m->>'applied')::boolean, false), (m->>'confirmed_by_user')::boolean
    );
  end loop;

  for m in select * from jsonb_array_elements(coalesce(p_match_updates, '[]'::jsonb)) loop
    update artifact_matches set
      applied = coalesce((m->>'applied')::boolean, applied),
      confirmed_by_user = coalesce((m->>'confirmed_by_user')::boolean, confirmed_by_user)
    where id = (m->>'id')::uuid and user_id = p_user_id;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into progress_events(user_id, tree_id, node_type, node_id, source_type, source_id, progress_delta, before_progress, after_progress, detail)
    values (
      p_user_id, p_tree_id, e->>'node_type', e->>'node_id', e->>'source_type',
      (e->>'source_id')::uuid, coalesce((e->>'progress_delta')::int, 0),
      (e->>'before_progress')::int, (e->>'after_progress')::int, coalesce(e->'detail', '{}'::jsonb)
    );
  end loop;

  for a in select * from jsonb_array_elements(coalesce(p_achievements, '[]'::jsonb)) loop
    insert into achievements(user_id, node_id, type, detail)
    values (p_user_id, a->>'node_id', a->>'type', coalesce(a->'detail', '{}'::jsonb));
  end loop;

  update trees set tree_data = coalesce(p_tree_data, t.tree_data), updated_at = v_now where id = p_tree_id;

  return jsonb_build_object('log_id', v_log_id, 'updated_at', v_now);
end $$;
revoke all on function public.apply_progress_transaction(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_progress_transaction(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
