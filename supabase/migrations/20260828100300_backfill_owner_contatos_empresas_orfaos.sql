-- Backfill dos contatos e empresas que ficaram sem dono.
--
-- Duas causas somadas. A primeira: 20260827100400_contact_company_owner.sql
-- preencheu `owner_id` a partir do negócio vivo mais recente, então quem não
-- tinha negócio ficou nulo. A segunda, e a que continuava produzindo órfãos
-- todo dia: `addContact` e `addCompany` em src/hooks/use-crm-mutations.ts nunca
-- gravaram `owner_id` -- ao contrário de `addDeal`, que sempre gravou
-- `owner_id: deal.ownerId || userId`. Por isso o problema não era da Ana nem do
-- papel vendedor: todo contato criado pela interface nascia órfão, para
-- qualquer pessoa. O caminho de criação foi corrigido no mesmo commit; esta
-- migration só limpa o que já estava no banco.
--
-- Quem é o dono, na falta de uma coluna de criador em `contacts`/`companies`:
-- o primeiro ator registrado no histórico (`contact_history.actor_user_id` /
-- `company_history.actor_user_id`), e, se não houver histórico, o dono do
-- negócio vivo mais recente ligado ao registro.
--
-- Em ambos os casos só aceita o candidato se ele for membro `accepted` do
-- MESMO workspace do registro. Sem essa trava, um ator que já saiu do time
-- viraria dono de um registro que ele não enxerga mais, e o registro sumiria da
-- tela de todo mundo em vez de aparecer sem dono -- trocaríamos um defeito
-- visível por um invisível. Quem não tiver candidato válido continua sem dono,
-- de propósito.

update public.contacts c
   set owner_id = cand.user_id
  from (
    select c2.id,
           coalesce(
             (select h.actor_user_id from public.contact_history h
               where h.contact_id = c2.id and h.actor_user_id is not null
               order by h.created_at limit 1),
             (select d.owner_id from public.deals d
               where d.contact_id = c2.id and d.deleted_at is null and d.owner_id is not null
               order by d.updated_at desc limit 1)
           ) as user_id,
           c2.workspace_id
      from public.contacts c2
     where c2.owner_id is null
  ) cand
 where c.id = cand.id
   and cand.user_id is not null
   and exists (
     select 1 from public.workspace_members m
      where m.workspace_id = cand.workspace_id
        and m.member_user_id = cand.user_id
        and m.status = 'accepted'
   );

update public.companies co
   set owner_id = cand.user_id
  from (
    select co2.id,
           coalesce(
             (select h.actor_user_id from public.company_history h
               where h.company_id = co2.id and h.actor_user_id is not null
               order by h.created_at limit 1),
             (select d.owner_id from public.deals d
               where d.company_id = co2.id and d.deleted_at is null and d.owner_id is not null
               order by d.updated_at desc limit 1)
           ) as user_id,
           co2.workspace_id
      from public.companies co2
     where co2.owner_id is null
  ) cand
 where co.id = cand.id
   and cand.user_id is not null
   and exists (
     select 1 from public.workspace_members m
      where m.workspace_id = cand.workspace_id
        and m.member_user_id = cand.user_id
        and m.status = 'accepted'
   );
