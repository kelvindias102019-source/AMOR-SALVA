-- =====================================================================
-- META CONVERSIONS API — CAMPOS E CONTROLE DE IDEMPOTÊNCIA
-- Execute no Supabase usado pelo backend antes do deploy.
-- Não apaga dados existentes.
-- =====================================================================

begin;

alter table public.donations add column if not exists fbp text;
alter table public.donations add column if not exists fbc text;
alter table public.donations add column if not exists client_ip_address text;
alter table public.donations add column if not exists client_user_agent text;
alter table public.donations add column if not exists event_source_url text;

alter table public.donations add column if not exists meta_event_id text;
alter table public.donations add column if not exists meta_event_status text;
alter table public.donations add column if not exists meta_event_attempts integer not null default 0;
alter table public.donations add column if not exists meta_event_last_attempt_at timestamptz;
alter table public.donations add column if not exists meta_event_sent_at timestamptz;
alter table public.donations add column if not exists meta_event_response jsonb;
alter table public.donations add column if not exists meta_event_error jsonb;

update public.donations
set meta_event_id = external_reference
where meta_event_id is null
  and external_reference is not null;

create index if not exists donations_meta_event_pending_idx
  on public.donations(status, meta_event_status, meta_event_last_attempt_at)
  where meta_event_sent_at is null;

create unique index if not exists donations_meta_event_id_unique_idx
  on public.donations(meta_event_id)
  where meta_event_id is not null;

create or replace function public.claim_meta_purchase(
  p_external_reference text
)
returns setof public.donations
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.donations
  set
    meta_event_id = coalesce(meta_event_id, external_reference),
    meta_event_status = 'PROCESSING',
    meta_event_attempts = coalesce(meta_event_attempts, 0) + 1,
    meta_event_last_attempt_at = now(),
    updated_at = now()
  where external_reference = p_external_reference
    and status = 'COMPLETED'
    and meta_event_sent_at is null
    and (
      meta_event_status is null
      or meta_event_status = 'FAILED'
      or (
        meta_event_status = 'PROCESSING'
        and meta_event_last_attempt_at < now() - interval '10 minutes'
      )
    )
  returning *;
end;
$$;

revoke all on function public.claim_meta_purchase(text)
  from public, anon, authenticated;

grant execute on function public.claim_meta_purchase(text)
  to service_role;

grant select, insert, update, delete on public.donations
  to service_role;

grant usage on schema public to service_role;

notify pgrst, 'reload schema';

commit;

-- Verificação:
-- select
--   external_reference,
--   status,
--   meta_event_status,
--   meta_event_attempts,
--   meta_event_sent_at,
--   meta_event_error
-- from public.donations
-- order by created_at desc
-- limit 20;
