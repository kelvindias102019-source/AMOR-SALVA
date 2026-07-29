-- Migração segura de uma base anterior para os campos usados pela BravoPay.
begin;

alter table public.donations alter column platform set default 'BRAVOPAY';
update public.donations set platform = 'BRAVOPAY' where platform is null or platform <> 'HISTORICO';

alter table public.donations drop constraint if exists donations_status_check;
alter table public.donations add constraint donations_status_check
check (status in ('CREATING','PENDING','COMPLETED','FAILED','REFUNDED','CHARGEBACK'));

alter table public.webhook_events add column if not exists event_id text;
alter table public.webhook_events add column if not exists event_type text;
create unique index if not exists webhook_events_event_id_unique_idx
on public.webhook_events(event_id) where event_id is not null;

commit;
notify pgrst, 'reload schema';
