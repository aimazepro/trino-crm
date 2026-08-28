-- `find_contact_by_phone` estava quebrada desde o rename user_id -> workspace_id:
-- o corpo filtrava por `c.user_id`, coluna que não existe mais em `contacts`
-- (hoje são `workspace_id` e `owner_id`). Toda chamada devolvia
-- `42703 column c.user_id does not exist`.
--
-- Não aparecia como erro em lugar nenhum porque src/lib/whatsapp/linking.ts
-- fazia `const { data: contactId } = await admin.rpc(...)` e descartava o
-- `error`: a função explodia, `contactId` vinha undefined, e a conversa do
-- WhatsApp era criada sem vínculo com contato nem negócio. O sintoma que se via
-- era "a conversa não acha o contato", não "a função está quebrada". O descarte
-- do erro foi corrigido junto, no mesmo commit.
--
-- Aproveitando a recriação: o parâmetro passa a se chamar `p_workspace_id`. Os
-- dois chamadores sempre passaram um workspace_id de verdade
-- (`connection.userId` é `row.workspace_id`, ver src/lib/whatsapp/connection.ts),
-- e o nome `p_user_id` era justamente o que fazia a leitura parecer certa.
--
-- Precisa de DROP: mudar nome de parâmetro não é permitido em
-- CREATE OR REPLACE. É uma migration só, aplicada atômica.
drop function if exists public.find_contact_by_phone(uuid, text);

create function public.find_contact_by_phone(p_workspace_id uuid, p_phone text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id
  from contacts c
  where c.workspace_id = p_workspace_id
    and exists (
      select 1
      from jsonb_array_elements(
             case when jsonb_typeof(c.phones) = 'array' then c.phones else '[]'::jsonb end
           ) as p
      where length(regexp_replace(p->>'value', '\D', '', 'g')) >= 8
        and right(regexp_replace(p->>'value', '\D', '', 'g'), 8) = right(regexp_replace(p_phone, '\D', '', 'g'), 8)
    )
  order by c.created_at
  limit 1
$$;

-- O DROP levou junto o revoke de 20260828100100. Refeito aqui, senão a função
-- volta a nascer com EXECUTE para `anon` via ALTER DEFAULT PRIVILEGES.
revoke all on function public.find_contact_by_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.find_contact_by_phone(uuid, text) to service_role;
