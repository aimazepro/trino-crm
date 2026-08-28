-- Fix round 1 da revisão da Fase 3 (Tasks 16 e 19).
--
-- F1: `revoke all on function ... from public` NÃO revoga do `anon`. O
-- Supabase concede EXECUTE ao `anon` via ALTER DEFAULT PRIVILEGES no momento
-- do CREATE, e esse grant explícito sobrevive ao revoke do pseudo-papel
-- PUBLIC -- confirmado ao vivo (`proacl` das duas funções trazia
-- `anon=X/postgres`, ausente em my_workspace_ids()/is_ws_admin()). Hoje não
-- vaza nem escreve (as duas dependem de auth.uid(), nulo pra anon), mas a
-- superfície ficava aberta pela chave anônima via POST /rest/v1/rpc/....
--
-- F3: sync_my_member_identity virava `returns void` -- o cliente não tinha
-- como distinguir "atualizou" de "0 linhas" (RLS/membership não aceita,
-- etc.), e o Perfil mostrava "Nome atualizado." mesmo quando nada mudou pro
-- time. Passa a `returns integer` (linhas afetadas).
--
-- F4: avatar_url passou a aceitar qualquer string de qualquer membro
-- autenticado (antes só admin escrevia essa coluna). Um valor fora do bucket
-- vira <img src> no navegador de todo colega (OwnerBadge) -- pixel de
-- rastreio de graça. Passa a exigir o prefixo público real do bucket
-- `avatars` deste projeto; fora disso, é ignorado (não grava), sem erro.

-- F7(b): documenta a limitação de multi-workspace na própria função (o
-- header do arquivo já foi corrigido localmente -- ver nota no relatório).
create or replace function public.team_scoreboard(
  period_start date,
  period_end date
)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  deals_won bigint,
  value_won numeric,
  deals_open bigint,
  activities_done bigint,
  calls_made bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ws uuid;
begin
  -- `limit 1` sem `order by`: hoje ninguém pertence a mais de um workspace,
  -- então a linha escolhida é sempre a única que existe. Se isso deixar de
  -- ser verdade, este limit vira uma escolha arbitrária de qual workspace
  -- vira "o" placar -- mesmo aviso em sync_my_member_identity abaixo.
  select workspace_id into ws from public.workspace_members
   where member_user_id = auth.uid() and status = 'accepted' limit 1;

  if ws is null then
    raise exception 'sem workspace';
  end if;

  return query
  select
    m.member_user_id as user_id,
    coalesce(m.name, m.email) as name,
    m.avatar_url,
    m.role,
    coalesce(won.n, 0) as deals_won,
    coalesce(won.v, 0) as value_won,
    coalesce(open_.n, 0) as deals_open,
    coalesce(act.n, 0) as activities_done,
    coalesce(cal.n, 0) as calls_made
  from public.workspace_members m
  left join lateral (
    select count(*) n, coalesce(sum(d.value), 0) v
      from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ganho' and d.deleted_at is null
       and d.updated_at::date between period_start and period_end
  ) won on true
  left join lateral (
    select count(*) n from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ativo' and d.deleted_at is null
  ) open_ on true
  left join lateral (
    select count(*) n from public.activities a
     where a.workspace_id = ws and a.assignee_id = m.member_user_id
       and a.completed is true
       and a.date::date between period_start and period_end
  ) act on true
  left join lateral (
    select count(*) n from public.telephony_calls c
     where c.workspace_id = ws and c.user_id = m.member_user_id
       and c.created_at::date between period_start and period_end
  ) cal on true
  where m.workspace_id = ws
    and m.status = 'accepted'
    and m.member_user_id is not null
  order by coalesce(won.v, 0) desc, coalesce(m.name, m.email);
end;
$$;

-- returns void -> returns integer: precisa DROP (CREATE OR REPLACE não deixa
-- mudar o tipo de retorno). Recriada logo em seguida, sem janela sem a
-- função -- é uma migration só, aplicada atômica.
drop function if exists public.sync_my_member_identity(text, text);

create function public.sync_my_member_identity(
  p_name text default null,
  p_avatar_url text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  n int;
  v_avatar text;
begin
  -- Só aceita avatar_url que já bata com o prefixo público do bucket
  -- `avatars` deste projeto -- o mesmo que supabase.storage.from("avatars").
  -- getPublicUrl() monta no cliente. Fora disso é ignorado (não grava, sem
  -- erro): sem isto, qualquer membro autenticado gravava URL arbitrária que
  -- vira <img src> no navegador dos colegas (OwnerBadge).
  v_avatar := case
    when p_avatar_url is null then null
    when p_avatar_url like 'https://etdkzpiehoivrviylemd.supabase.co/storage/v1/object/public/avatars/%' then p_avatar_url
    else null
  end;

  -- Atualiza TODAS as linhas aceitas do chamador, sem filtro de workspace --
  -- proposital (a Task 16 já tinha decidido não aceitar workspace_id como
  -- parâmetro, pra não abrir brecha de forjar). Hoje é inócuo: ninguém
  -- pertence a dois workspaces. Se isso mudar, esta função sincroniza a
  -- identidade em todos ao mesmo tempo, o que pode não ser o desejado --
  -- mesmo aviso em team_scoreboard acima.
  update public.workspace_members
     set name = coalesce(p_name, name),
         avatar_url = coalesce(v_avatar, avatar_url)
   where member_user_id = auth.uid()
     and status = 'accepted';

  get diagnostics n = row_count;
  return n;
end;
$$;

-- F1: revoga de PUBLIC (pseudo-papel) e explicitamente de anon (o grant real
-- que estava aberto), depois concede só pra authenticated.
revoke all on function public.team_scoreboard(date, date) from public, anon;
revoke all on function public.sync_my_member_identity(text, text) from public, anon;
grant execute on function public.team_scoreboard(date, date) to authenticated;
grant execute on function public.sync_my_member_identity(text, text) to authenticated;
