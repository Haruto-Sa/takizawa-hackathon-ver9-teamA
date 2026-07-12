-- v2: 木(Trunk)/枝(Branch)は trees.tree_data(jsonb)に保持し、
-- 葉(Leaf)・日次記録・進捗イベントは独立テーブルを正とする。

alter table public.profiles
  add column if not exists learning_conditions jsonb,
  add column if not exists onboarding_answers jsonb,
  add column if not exists updated_at timestamptz default now();

alter table public.trees
  add column if not exists schema_version int not null default 1,
  add column if not exists goal text;

create table public.leaves (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  branch_id text not null,
  label text not null,
  description text not null default '',
  completion_condition text not null default '',
  estimated_minutes int not null default 30,
  scheduled_date date,
  status text not null default 'todo'
    check (status in ('todo','doing','done','skipped')),
  progress int not null default 0 check (progress between 0 and 100),
  evidence_count int not null default 0,
  recently_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tree_id, id)
);
create index leaves_user_branch on public.leaves(user_id, tree_id, branch_id);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  leaf_id text,
  branch_id text not null,
  note text,
  studied_minutes int check (studied_minutes between 0 and 1440),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  node_type text not null check (node_type in ('trunk','branch','leaf')),
  node_id text not null,
  source_type text not null
    check (source_type in ('quiz','daily_log','artifact','manual','system')),
  source_id uuid,
  progress_delta int not null,
  before_progress int,
  after_progress int,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.leaf_generations (
  request_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  branch_id text not null,
  created_at timestamptz not null default now()
);

alter table public.leaves enable row level security;
alter table public.daily_logs enable row level security;
alter table public.progress_events enable row level security;
alter table public.leaf_generations enable row level security;

-- 書き込みはすべて Edge Function(service_role)経由。フロントは自分の行の参照のみ。
create policy "leaves select own" on public.leaves for select to authenticated using (user_id = auth.uid());
create policy "daily_logs select own" on public.daily_logs for select to authenticated using (user_id = auth.uid());
create policy "daily_logs insert own" on public.daily_logs for insert to authenticated with check (user_id = auth.uid());
create policy "progress_events select own" on public.progress_events for select to authenticated using (user_id = auth.uid());
-- leaf_generations はポリシーなし = フロントから一切アクセス不可

-- 進捗反映の汎用トランザクション。tree_data 更新・葉upsert・日次記録・
-- 進捗イベント・achievements を1トランザクションで適用する。
create or replace function public.apply_progress_transaction(
  p_user_id uuid,
  p_tree_id uuid,
  p_expected_updated_at timestamptz,
  p_tree_data jsonb,
  p_leaf_upserts jsonb default '[]'::jsonb,
  p_daily_log jsonb default null,
  p_events jsonb default '[]'::jsonb,
  p_achievements jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare t trees%rowtype; v_log_id uuid; l jsonb; e jsonb; a jsonb; v_now timestamptz := now();
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
revoke all on function public.apply_progress_transaction(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_progress_transaction(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
