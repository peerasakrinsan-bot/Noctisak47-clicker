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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_saves'
      and policyname = 'cloud_saves_public_read'
  ) then
    create policy cloud_saves_public_read
      on public.cloud_saves
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_saves'
      and policyname = 'cloud_saves_public_insert'
  ) then
    create policy cloud_saves_public_insert
      on public.cloud_saves
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_saves'
      and policyname = 'cloud_saves_public_update'
  ) then
    create policy cloud_saves_public_update
      on public.cloud_saves
      for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;
