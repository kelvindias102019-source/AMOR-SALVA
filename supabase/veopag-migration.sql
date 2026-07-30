-- Migração VeoPag sem apagar ou recriar public.donations
create extension if not exists pgcrypto;

alter table public.donations add column if not exists provider text default 'veopag';
alter table public.donations add column if not exists provider_transaction_id text;
alter table public.donations add column if not exists external_reference text;
alter table public.donations add column if not exists amount_cents bigint;
alter table public.donations add column if not exists fee_cents bigint;
alter table public.donations add column if not exists net_cents bigint;
alter table public.donations add column if not exists status text default 'PENDING';
alter table public.donations add column if not exists pix_copy_paste text;
alter table public.donations add column if not exists paid_at timestamptz;
alter table public.donations add column if not exists updated_at timestamptz default now();
alter table public.donations add column if not exists provider_payload jsonb default '{}'::jsonb;

create unique index if not exists donations_external_reference_idx
  on public.donations(external_reference) where external_reference is not null;
create unique index if not exists donations_provider_transaction_idx
  on public.donations(provider_transaction_id) where provider_transaction_id is not null;
create index if not exists donations_provider_status_updated_idx
  on public.donations(provider,status,updated_at);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

alter table public.donations enable row level security;
alter table public.webhook_events enable row level security;
revoke all on public.donations from anon,authenticated;
revoke all on public.webhook_events from anon,authenticated;
grant all on public.donations to service_role;
grant all on public.webhook_events to service_role;

notify pgrst,'reload schema';
