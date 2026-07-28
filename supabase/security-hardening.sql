-- AMOR SALVA — endurecimento de segurança sem apagar dados
create extension if not exists pgcrypto;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
create index if not exists webhook_events_created_at_idx on public.webhook_events(created_at desc);
alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events to service_role;

create or replace function public.get_paid_donation_total()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents),0)::bigint
  from public.donations
  where status='COMPLETED';
$$;
revoke all on function public.get_paid_donation_total() from public, anon, authenticated;
grant execute on function public.get_paid_donation_total() to service_role;

alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
grant all on public.donations to service_role;

-- Views administrativas: respeitam as permissões do chamador e não ficam públicas.
do $$
begin
  if to_regclass('public.donation_payments_admin') is not null then
    execute 'alter view public.donation_payments_admin set (security_invoker=true)';
    execute 'revoke all on public.donation_payments_admin from anon, authenticated';
    execute 'grant select on public.donation_payments_admin to service_role';
  end if;
  if to_regclass('public.donation_summary') is not null then
    execute 'alter view public.donation_summary set (security_invoker=true)';
    execute 'revoke all on public.donation_summary from anon, authenticated';
    execute 'grant select on public.donation_summary to service_role';
  end if;
end $$;

-- Pagadores sintéticos nunca acessíveis pelo navegador.
do $$
begin
  if to_regclass('public.test_payers') is not null then
    execute 'alter table public.test_payers enable row level security';
    execute 'revoke all on public.test_payers from anon, authenticated';
    execute 'grant all on public.test_payers to service_role';
  end if;
end $$;

notify pgrst, 'reload schema';
