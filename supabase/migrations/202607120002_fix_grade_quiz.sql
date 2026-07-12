-- 採点修正: with ordinality の ord は bigint で、jsonb ->> bigint 演算子が存在せず
-- 採点が常に実行時エラーになっていた。(ord-1)::int にキャストする。
create or replace function public.grade_quiz_transaction(p_quiz_id uuid,p_user_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s quiz_sessions%rowtype; t trees%rowtype; qs jsonb; score numeric; passed boolean; updated jsonb; explanations jsonb;
begin
 select * into s from quiz_sessions where id=p_quiz_id for update;
 if not found or s.user_id<>p_user_id then raise exception 'quiz_not_found'; end if;
 if s.used_at is not null then raise exception 'quiz_already_used'; end if;
 if s.expires_at<now() then raise exception 'quiz_expired'; end if;
 qs:=s.questions_private;
 select coalesce(avg(case when (p_answers->>((ord-1)::int))::int=(q->>'correct_index')::int then 1 else 0 end),0),jsonb_agg(q->>'explanation' order by ord)
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
