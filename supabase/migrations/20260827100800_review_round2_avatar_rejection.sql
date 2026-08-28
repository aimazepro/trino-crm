-- Fix round 2 da revisão da Fase 3 (junção do F3 com o F4 do round 1).
--
-- F8: sync_my_member_identity devolvia o row_count do UPDATE. Quando
-- p_avatar_url reprovava na validação de prefixo, v_avatar virava null e o
-- `coalesce(v_avatar, avatar_url)` era no-op -- mas a linha ainda casava no
-- WHERE member_user_id = auth.uid(), e a função devolvia 1 mesmo sem gravar
-- nada. Confirmado ao vivo: sync_my_member_identity(null,
-- 'https://evil.example.com/x.png') devolvia 1 com avatar_url continuando
-- null. O Perfil lia esse 1 como sucesso e mostrava "Foto de perfil
-- atualizada." com o time vendo o avatar velho -- a mesma classe de falha
-- silenciosa que o F3 existia para fechar, um nível mais fundo.
--
-- Escolhida a opção mais simples: quando um p_avatar_url foi FORNECIDO e
-- reprova na validação, a chamada inteira é tratada como falha -- devolve 0
-- e não grava NADA (nem o nome, se veio junto no mesmo parâmetro). Prefere-se
-- isto a "gravar nome mas reportar falha", que deixaria o retorno mentindo
-- sobre o que realmente aconteceu. Hoje os dois chamadores no cliente nunca
-- combinam nome+avatar na mesma chamada, então isto não muda nenhum caminho
-- observável na UI -- só fecha o buraco pra quando/se alguém combinar.
--
-- Regra preservada: p_avatar_url = null (o caso de só atualizar o nome) não
-- é rejeição -- não entra nesse desvio, segue o fluxo normal e devolve 1 no
-- caminho feliz.

create or replace function public.sync_my_member_identity(
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
  -- getPublicUrl() monta no cliente.
  v_avatar := case
    when p_avatar_url is null then null
    when p_avatar_url like 'https://etdkzpiehoivrviylemd.supabase.co/storage/v1/object/public/avatars/%' then p_avatar_url
    else null
  end;

  -- Avatar fornecido mas reprovado: falha explícita, não no-op silencioso.
  -- Sem isto o UPDATE abaixo ainda casaria a linha por member_user_id e
  -- devolveria 1 mesmo sem gravar o avatar -- o chamador achava que tinha
  -- sincronizado.
  if p_avatar_url is not null and v_avatar is null then
    return 0;
  end if;

  -- Atualiza TODAS as linhas aceitas do chamador, sem filtro de workspace --
  -- proposital (nota do round 1: a Task 16 já tinha decidido não aceitar
  -- workspace_id como parâmetro). Hoje é inócuo: ninguém pertence a dois
  -- workspaces.
  update public.workspace_members
     set name = coalesce(p_name, name),
         avatar_url = coalesce(v_avatar, avatar_url)
   where member_user_id = auth.uid()
     and status = 'accepted';

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.sync_my_member_identity(text, text) from public, anon;
grant execute on function public.sync_my_member_identity(text, text) to authenticated;
