-- AI生成の入出力ログ。Edge Functions が service_role で書き込む。
create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  function_name text not null,
  prompt_version text not null,
  model text,
  input jsonb,
  raw_output jsonb,
  parsed_ok boolean not null default false,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
alter table public.generation_logs enable row level security;
-- ポリシーなし = service_role のみアクセス可(フロントからは読み書き不可)
