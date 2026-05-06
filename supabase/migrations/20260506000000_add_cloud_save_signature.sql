create table if not exists public.cloud_saves (
  player_id text primary key,
  secret_key text not null,
  save_data jsonb not null default '{}'::jsonb,
  signature text,
  uploaded_at timestamptz not null default now()
);

alter table public.cloud_saves
  add column if not exists signature text;

alter table public.cloud_saves
  add column if not exists uploaded_at timestamptz not null default now();

create index if not exists cloud_saves_uploaded_at_idx
  on public.cloud_saves (uploaded_at desc);

alter table public.cloud_saves enable row level security;

-- Cloud saves contain player secrets and signed save data. Do not expose this
-- table through the public anon REST API; all reads/writes must go through the
-- save-sign Edge Function with SUPABASE_SERVICE_ROLE_KEY.
drop policy if exists cloud_saves_public_read on public.cloud_saves;
drop policy if exists cloud_saves_public_insert on public.cloud_saves;
drop policy if exists cloud_saves_public_update on public.cloud_saves;

revoke all on table public.cloud_saves from anon;
revoke all on table public.cloud_saves from authenticated;
