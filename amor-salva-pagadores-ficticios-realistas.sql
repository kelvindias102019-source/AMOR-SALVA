-- =========================================================
-- AMOR SALVA — PAGADORES FICTÍCIOS REALISTAS PARA TESTE
-- Dados totalmente sintéticos. Use somente em teste/homologação.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.test_payers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null,
  cpf text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint test_payers_cpf_digits_chk
    check (cpf ~ '^[0-9]{11}$'),

  constraint test_payers_phone_digits_chk
    check (phone ~ '^[0-9]{10,13}$')
);

comment on table public.test_payers is
'Pagadores sintéticos e realistas para testes internos de geração de PIX. Não usar em produção.';

alter table public.test_payers enable row level security;

revoke all on table public.test_payers from anon;
revoke all on table public.test_payers from authenticated;
grant select, insert, update, delete on table public.test_payers to service_role;

insert into public.test_payers
  (full_name, email, phone, cpf)
values
  ('Mariana Alves Ferreira', 'mariana.ferreira.teste@example.com', '11987654321', '78657930307'),
  ('Lucas Henrique Souza', 'lucas.souza.teste@example.com', '21984561234', '21954083165'),
  ('Camila Rodrigues Lima', 'camila.lima.teste@example.com', '31991234567', '12685509224'),
  ('Rafael Gomes Martins', 'rafael.martins.teste@example.com', '41983456789', '89623379080'),
  ('Juliana Costa Ribeiro', 'juliana.ribeiro.teste@example.com', '51992345678', '39531048533'),
  ('Bruno Almeida Santos', 'bruno.santos.teste@example.com', '61981234567', '36295062830'),
  ('Fernanda Oliveira Melo', 'fernanda.melo.teste@example.com', '71993456789', '33967071170'),
  ('Diego Pereira Rocha', 'diego.rocha.teste@example.com', '81984567890', '24982770646'),
  ('Aline Carvalho Mendes', 'aline.mendes.teste@example.com', '85991239876', '89077994661'),
  ('Gustavo Nunes Barbosa', 'gustavo.barbosa.teste@example.com', '91982345678', '21005335338'),
  ('Patricia Moreira Campos', 'patricia.campos.teste@example.com', '11976543210', '82660053979'),
  ('Eduardo Vieira Lopes', 'eduardo.lopes.teste@example.com', '21973456789', '89528593240'),
  ('Renata Martins Correia', 'renata.correia.teste@example.com', '31988776655', '50795317003'),
  ('Thiago Araujo Freitas', 'thiago.freitas.teste@example.com', '41999887766', '12345678909'),
  ('Larissa Teixeira Moura', 'larissa.moura.teste@example.com', '51977665544', '11144477735')
on conflict (cpf) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  active = true;

create or replace function public.get_random_test_payer()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  cpf text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    tp.id,
    tp.full_name,
    tp.email,
    tp.phone,
    tp.cpf
  from public.test_payers tp
  where tp.active = true
  order by random()
  limit 1;
$$;

revoke all on function public.get_random_test_payer() from public;
revoke all on function public.get_random_test_payer() from anon;
revoke all on function public.get_random_test_payer() from authenticated;
grant execute on function public.get_random_test_payer() to service_role;

notify pgrst, 'reload schema';

-- TESTES:
-- select * from public.test_payers order by full_name;
-- select * from public.get_random_test_payer();
