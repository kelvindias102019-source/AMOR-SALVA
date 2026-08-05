-- Meta Conversions API: colunas necessárias. Não depende de RPC.
begin;

alter table public.donations add column if not exists fbclid text;
alter table public.donations add column if not exists fbp text;
alter table public.donations add column if not exists fbc text;
alter table public.donations add column if not exists client_ip_address text;
alter table public.donations add column if not exists client_user_agent text;
alter table public.donations add column if not exists event_source_url text;
alter table public.donations add column if not exists meta_event_id text;
alter table public.donations add column if not exists meta_event_status text default 'PENDING';
alter table public.donations add column if not exists meta_event_attempts integer not null default 0;
alter table public.donations add column if not exists meta_event_last_attempt_at timestamptz;
alter table public.donations add column if not exists meta_event_sent_at timestamptz;
alter table public.donations add column if not exists meta_event_response jsonb;
alter table public.donations add column if not exists meta_event_error jsonb;

update public.donations
set meta_event_id=external_reference
where meta_event_id is null and external_reference is not null;

create unique index if not exists donations_meta_event_id_unique_idx
on public.donations(meta_event_id) where meta_event_id is not null;

create index if not exists donations_meta_retry_idx
on public.donations(status,meta_event_status,meta_event_last_attempt_at)
where meta_event_sent_at is null;

grant select,insert,update,delete on public.donations to service_role;
grant usage on schema public to service_role;
notify pgrst, 'reload schema';
commit;
