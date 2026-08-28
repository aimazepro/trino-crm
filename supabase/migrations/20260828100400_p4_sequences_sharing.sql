-- P4 — Compartilhamento de sequência que funciona de verdade.
--
-- O modal já oferecia "Só eu", "Usuários específicos" e "Todo o workspace",
-- mas gravava a escolha como uma string `sharing:X` dentro do array `tags` e
-- NADA lia isso para decidir visibilidade: a RLS de select era do workspace
-- inteiro, então toda sequência aparecia para todo mundo, escolhesse o que
-- escolhesse. "Usuários específicos" era pior ainda -- não existia lugar
-- nenhum guardando *quais* usuários.
--
-- Esta migration dá lastro às três opções: dono na própria tabela, tabela de
-- compartilhamento para o caso "específicos", e a RLS de select passando a
-- respeitar as duas.

-- ── 1. Dono e modo de compartilhamento ───────────────────────────────────────
-- Sem FK para auth.users: é o padrão do resto do schema (deals.owner_id,
-- activities.assignee_id e workspace_members.member_user_id também são uuid
-- solto). Manter a convenção evita que apagar um usuário derrube dados por um
-- caminho que nenhuma outra tabela tem.
alter table public.sequences
  add column if not exists owner_id uuid,
  add column if not exists sharing text not null default 'ONLY_ME';

alter table public.sequences
  drop constraint if exists sequences_sharing_check;
alter table public.sequences
  add constraint sequences_sharing_check
  check (sharing in ('ONLY_ME', 'SPECIFIC_USERS', 'WORKSPACE'));

-- ── 2. Com quem a sequência foi compartilhada ────────────────────────────────
create table if not exists public.sequence_shares (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  shared_with_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (sequence_id, shared_with_user_id)
);

create index if not exists sequence_shares_user_idx
  on public.sequence_shares (shared_with_user_id);

alter table public.sequence_shares enable row level security;

-- ── 3. Backfill ──────────────────────────────────────────────────────────────
-- Dono: o admin mais antigo do workspace. Não há coluna de autor no histórico
-- de `sequences`, então não dá para saber quem criou cada uma -- e o admin é o
-- único palpite que não inventa autoria de vendedor nenhum.
update public.sequences s
set owner_id = (
  select m.member_user_id
  from public.workspace_members m
  where m.workspace_id = s.workspace_id
    and m.role = 'admin'
    and m.status = 'accepted'
  -- workspace_members não tem created_at; invited_at é a marca de antiguidade
  -- que a tabela guarda.
  order by m.invited_at nulls last
  limit 1
)
where s.owner_id is null;

-- Modo: respeita a tag que o modal vinha gravando quando ela existe. Quando
-- não existe, assume WORKSPACE -- que é o comportamento *real* de hoje (todo
-- mundo vê tudo). O contrário faria sequências que a equipe já usa sumirem da
-- tela na primeira carga depois do deploy.
update public.sequences s
set sharing = coalesce(
  (select replace(t, 'sharing:', '')
   from unnest(s.tags) as t
   where t like 'sharing:%'
     and replace(t, 'sharing:', '') in ('ONLY_ME', 'SPECIFIC_USERS', 'WORKSPACE')
   limit 1),
  'WORKSPACE'
);

-- A tag some: manter as duas fontes seria repetir o defeito que esta migration
-- conserta, agora com a chance de discordarem entre si.
update public.sequences
set tags = array(select t from unnest(tags) as t where t not like 'sharing:%')
where exists (select 1 from unnest(tags) as t where t like 'sharing:%');

-- Depois do backfill não sobra sequência sem dono, e daí em diante a policy de
-- insert obriga o dono a ser quem está criando. `not null` fecha o estado
-- ambíguo: sem ele, uma sequência com owner_id nulo e sharing ONLY_ME ficaria
-- invisível para todo mundo, inclusive para quem a criou.
alter table public.sequences
  alter column owner_id set not null;

-- ── 4. Quem enxerga o quê ────────────────────────────────────────────────────
-- Predicado único, usado no select e repetido no update/delete: você só edita
-- o que você vê. Sem bypass de gerente de propósito -- "Apenas você vê e usa
-- este template" tem que ser literal, senão a opção volta a mentir, que é
-- exatamente o defeito de origem.
drop policy if exists "sequences: select" on public.sequences;
create policy "sequences: select" on public.sequences
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      sharing = 'WORKSPACE'
      or owner_id = (select auth.uid())
      or (
        sharing = 'SPECIFIC_USERS'
        and exists (
          select 1 from public.sequence_shares sh
          where sh.sequence_id = sequences.id
            and sh.shared_with_user_id = (select auth.uid())
        )
      )
    )
  );

-- Criar continua sendo de gerente/admin (P2), e agora o dono não é forjável:
-- tem que ser quem está inserindo.
drop policy if exists "sequences: insert" on public.sequences;
create policy "sequences: insert" on public.sequences
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (select public.is_ws_manager(workspace_id))
    and owner_id = (select auth.uid())
  );

drop policy if exists "sequences: update" on public.sequences;
create policy "sequences: update" on public.sequences
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (select public.is_ws_manager(workspace_id))
    and (
      sharing = 'WORKSPACE'
      or owner_id = (select auth.uid())
      or (
        sharing = 'SPECIFIC_USERS'
        and exists (
          select 1 from public.sequence_shares sh
          where sh.sequence_id = sequences.id
            and sh.shared_with_user_id = (select auth.uid())
        )
      )
    )
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (select public.is_ws_manager(workspace_id))
  );

drop policy if exists "sequences: delete" on public.sequences;
create policy "sequences: delete" on public.sequences
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (select public.is_ws_manager(workspace_id))
    and (
      sharing = 'WORKSPACE'
      or owner_id = (select auth.uid())
      or (
        sharing = 'SPECIFIC_USERS'
        and exists (
          select 1 from public.sequence_shares sh
          where sh.sequence_id = sequences.id
            and sh.shared_with_user_id = (select auth.uid())
        )
      )
    )
  );

-- ── 5. RLS de sequence_shares ────────────────────────────────────────────────
-- A policy de `sequences` acima consulta `sequence_shares`. Se as policies de
-- `sequence_shares` consultassem `sequences` de volta, o Postgres recusaria a
-- query inteira com "infinite recursion detected in policy for relation". Esta
-- função quebra o ciclo: sendo `security definer`, ela lê `sequences` sem
-- reentrar na RLS.
create or replace function public.is_sequence_owner(p_sequence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sequences s
    where s.id = p_sequence_id
      and s.owner_id = (select auth.uid())
  );
$$;

-- Lição do P0: `revoke from public` sozinho não basta, porque o Supabase
-- concede um grant explícito a `anon` no CREATE FUNCTION, e `anon` é outro
-- papel. Revogar dos dois.
revoke all on function public.is_sequence_owner(uuid) from public;
revoke all on function public.is_sequence_owner(uuid) from anon;
grant execute on function public.is_sequence_owner(uuid) to authenticated;
grant execute on function public.is_sequence_owner(uuid) to service_role;

-- Ler: o próprio compartilhamento, ou todos os de uma sequência sua.
drop policy if exists "sequence_shares: select" on public.sequence_shares;
create policy "sequence_shares: select" on public.sequence_shares
  for select using (
    shared_with_user_id = (select auth.uid())
    or public.is_sequence_owner(sequence_id)
  );

-- Escrever: só o dono da sequência decide com quem ela é compartilhada. Nem
-- outro gerente -- compartilhamento é do dono, não do cargo.
drop policy if exists "sequence_shares: insert" on public.sequence_shares;
create policy "sequence_shares: insert" on public.sequence_shares
  for insert with check (public.is_sequence_owner(sequence_id));

drop policy if exists "sequence_shares: delete" on public.sequence_shares;
create policy "sequence_shares: delete" on public.sequence_shares
  for delete using (public.is_sequence_owner(sequence_id));
