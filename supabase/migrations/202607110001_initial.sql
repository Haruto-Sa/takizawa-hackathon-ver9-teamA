create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, goal text, interests jsonb, created_at timestamptz not null default now());
create table public.trees (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, tree_data jsonb not null, updated_at timestamptz not null default now());
create table public.achievements (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, node_id text not null, type text not null check(type in ('quiz','artifact')), detail jsonb, created_at timestamptz not null default now());
create table public.quiz_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, tree_id uuid not null references public.trees(id) on delete cascade, node_id text not null, questions_private jsonb not null, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now());
alter table public.profiles enable row level security; alter table public.trees enable row level security; alter table public.achievements enable row level security; alter table public.quiz_sessions enable row level security;
create policy "profiles select own" on public.profiles for select to authenticated using(id=auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check(id=auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "trees select own" on public.trees for select to authenticated using(user_id=auth.uid());
create policy "achievements select own" on public.achievements for select to authenticated using(user_id=auth.uid());

create or replace function public.grade_quiz_transaction(p_quiz_id uuid,p_user_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s quiz_sessions%rowtype; t trees%rowtype; qs jsonb; score numeric; passed boolean; updated jsonb; explanations jsonb;
begin
 select * into s from quiz_sessions where id=p_quiz_id for update;
 if not found or s.user_id<>p_user_id then raise exception 'quiz_not_found'; end if;
 if s.used_at is not null then raise exception 'quiz_already_used'; end if;
 if s.expires_at<now() then raise exception 'quiz_expired'; end if;
 qs:=s.questions_private;
 select coalesce(avg(case when (p_answers->>(ord-1))::int=(q->>'correct_index')::int then 1 else 0 end),0),jsonb_agg(q->>'explanation' order by ord)
 into score,explanations from jsonb_array_elements(qs) with ordinality x(q,ord);
 passed:=score>=0.7;
 update quiz_sessions set used_at=now() where id=p_quiz_id;
 if passed then
  select * into t from trees where id=s.tree_id and user_id=p_user_id for update;
  updated := (
    select jsonb_set(
      t.tree_data,
      '{milestones}',
      jsonb_agg(
        jsonb_set(
          m,
          '{nodes}',
          (
            select jsonb_agg(
              case
                when n->>'id' = s.node_id then
                  n || jsonb_build_object(
                    'status', 'done',
                    'evidence', jsonb_build_object(
                      'type', 'quiz',
                      'passed_at', now(),
                      'detail', jsonb_build_object('score', score)
                    )
                  )
                when n->>'status' = 'locked'
                  and not exists (
                    select 1
                    from jsonb_array_elements(n->'prerequisite_ids') p
                    where not exists (
                      select 1
                      from jsonb_array_elements(t.tree_data->'milestones') mm,
                        jsonb_array_elements(mm->'nodes') nn
                      where nn->>'id' = p #>> '{}'
                        and (
                          nn->>'status' = 'done'
                          or nn->>'id' = s.node_id
                        )
                    )
                  ) then
                  n || '{"status":"unlocked"}'::jsonb
                else n
              end
              order by no
            )
            from jsonb_array_elements(m->'nodes')
              with ordinality nx(n, no)
          )
        )
        order by mo
      )
    )
    from jsonb_array_elements(t.tree_data->'milestones')
      with ordinality mx(m, mo)
  );
  update trees set tree_data=updated,updated_at=now() where id=t.id;
  insert into achievements(user_id,node_id,type,detail) values(p_user_id,s.node_id,'quiz',jsonb_build_object('score',score,'quiz_id',p_quiz_id));
 end if;
 return jsonb_build_object('passed',passed,'score',score,'explanations',explanations,'tree',case when passed then updated else null end);
end $$;
revoke all on function public.grade_quiz_transaction(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.grade_quiz_transaction(uuid,uuid,jsonb) to service_role;
