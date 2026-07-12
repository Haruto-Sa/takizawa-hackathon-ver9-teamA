-- grade_quiz_transaction を v2 ツリー(trunks/branches)対応に書き換える。
-- 合格時: 対象枝を done + progress 100 + evidence 追記、前提充足の locked 枝を unlocked、
-- 木の progress 再計算、core 枝が全て done の木を completed にする。
create or replace function public.grade_quiz_transaction(p_quiz_id uuid,p_user_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s quiz_sessions%rowtype; t trees%rowtype; qs jsonb; score numeric; passed boolean; updated jsonb; explanations jsonb; v_now timestamptz := now();
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
  if (t.tree_data->>'schema_version')::int is distinct from 2 then raise exception 'tree_schema_v2_required'; end if;
  updated := (
    select jsonb_set(t.tree_data, '{trunks}', jsonb_agg(
      jsonb_set(
        jsonb_set(
          jsonb_set(tr, '{branches}', nb.branches),
          '{progress}', to_jsonb(nb.progress)
        ),
        '{status}',
        case when nb.all_core_done then '"completed"'::jsonb else tr->'status' end
      )
      order by tord
    ))
    from jsonb_array_elements(t.tree_data->'trunks') with ordinality tx(tr, tord)
    cross join lateral (
      select
        jsonb_agg(nb2.b order by nb2.bord) as branches,
        coalesce(round(avg(case when nb2.b->>'kind' = 'core' then (nb2.b->>'progress')::numeric end))::int, 0) as progress,
        (count(*) filter (where nb2.b->>'kind' = 'core') > 0
          and bool_and(case when nb2.b->>'kind' = 'core' then nb2.b->>'status' = 'done' else true end)) as all_core_done
      from (
        select bord,
          case
            when b->>'id' = s.node_id then
              b || jsonb_build_object(
                'status', 'done',
                'progress', 100,
                'evidence', coalesce(b->'evidence', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                  'id', s.node_id || '-quiz-' || floor(extract(epoch from v_now))::bigint,
                  'type', 'quiz',
                  'verified', true,
                  'score', score,
                  'created_at', v_now
                ))
              )
            when b->>'status' = 'locked'
              and jsonb_array_length(coalesce(b->'prerequisite_ids', '[]'::jsonb)) > 0
              and not exists (
                select 1 from jsonb_array_elements(b->'prerequisite_ids') p
                where not exists (
                  select 1
                  from jsonb_array_elements(t.tree_data->'trunks') tt,
                    jsonb_array_elements(tt->'branches') bb
                  where bb->>'id' = p #>> '{}'
                    and (bb->>'status' = 'done' or bb->>'id' = s.node_id)
                )
              ) then b || '{"status":"unlocked"}'::jsonb
            else b
          end as b
        from jsonb_array_elements(tr->'branches') with ordinality bx(b, bord)
      ) nb2
    ) nb
  );
  update trees set tree_data=updated,updated_at=v_now where id=t.id;
  insert into achievements(user_id,node_id,type,detail) values(p_user_id,s.node_id,'quiz',jsonb_build_object('score',score,'quiz_id',p_quiz_id));
  insert into progress_events(user_id,tree_id,node_type,node_id,source_type,source_id,progress_delta,after_progress,detail)
  values(p_user_id,s.tree_id,'branch',s.node_id,'quiz',p_quiz_id,100,100,jsonb_build_object('score',score));
 end if;
 return jsonb_build_object('passed',passed,'score',score,'explanations',explanations,'tree',case when passed then updated else null end,'updated_node_ids',case when passed then jsonb_build_array(s.node_id) else '[]'::jsonb end);
end $$;
revoke all on function public.grade_quiz_transaction(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.grade_quiz_transaction(uuid,uuid,jsonb) to service_role;
