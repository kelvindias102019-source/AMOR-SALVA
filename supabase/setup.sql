create extension if not exists pgcrypto;
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  external_reference text not null unique,
  provider_id text,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED')),
  donor_name text,
  show_public boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists donations_status_idx on public.donations(status);
alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
