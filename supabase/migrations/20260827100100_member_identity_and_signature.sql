-- supabase/migrations/20260827100100_member_identity_and_signature.sql
--
-- Identidade do membro e assinatura por pessoa.
--
-- O avatar mora em auth.users.user_metadata, que o cliente não consegue ler
-- de OUTRO usuário -- por isso o avatar de colega nunca aparecia. Espelhar a
-- URL pública em workspace_members resolve sem rota de servidor: o bucket
-- `avatars` já é público e workspace_members já é legível por qualquer membro
-- do workspace.

alter table public.workspace_members
  add column if not exists avatar_url text;

-- Assinatura por membro. Deliberadamente SEM coluna de nome: a assinatura
-- deriva de workspace_members.name, o que a trava por construção -- não há
-- campo para o vendedor assinar com o nome de outra pessoa.
create table if not exists public.whatsapp_member_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.whatsapp_member_settings enable row level security;

-- Cada um lê a própria linha; gerente e admin leem todas (a tela de WhatsApp
-- do admin mostra quem está assinando).
create policy "whatsapp_member_settings: select"
  on public.whatsapp_member_settings for select
  using (
    workspace_id in (select my_workspace_ids())
    and (user_id = (select auth.uid()) or (select is_ws_manager(workspace_id)))
  );

-- Escrita é sempre da própria linha, inclusive para o admin: o toggle é uma
-- preferência pessoal, não uma configuração que se aplica a terceiros.
create policy "whatsapp_member_settings: insert"
  on public.whatsapp_member_settings for insert
  with check (
    workspace_id in (select my_workspace_ids())
    and user_id = (select auth.uid())
  );

create policy "whatsapp_member_settings: update"
  on public.whatsapp_member_settings for update
  using (
    workspace_id in (select my_workspace_ids())
    and user_id = (select auth.uid())
  );

-- Backfill de identidade -----------------------------------------------------

-- O aceite de convite gravava user_metadata.name; o app inteiro lê full_name.
-- Idempotente: só escreve quando full_name está ausente.
update auth.users
   set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', raw_user_meta_data->>'name')
 where raw_user_meta_data ? 'name'
   and not (raw_user_meta_data ? 'full_name');

-- Espelha nome e avatar do metadata para workspace_members quando faltarem.
update public.workspace_members m
   set name = coalesce(m.name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
       avatar_url = coalesce(m.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
  from auth.users u
 where u.id = m.member_user_id
   and (m.name is null or m.avatar_url is null);

-- Toda pessoa já aceita começa com assinatura ligada.
insert into public.whatsapp_member_settings (workspace_id, user_id)
select workspace_id, member_user_id
  from public.workspace_members
 where member_user_id is not null and status = 'accepted'
on conflict do nothing;
