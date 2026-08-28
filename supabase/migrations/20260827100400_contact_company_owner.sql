-- supabase/migrations/20260827100400_contact_company_owner.sql
--
-- Dono informativo. A visibilidade NÃO muda: contatos e empresas continuam
-- compartilhados no workspace, porque a base de contatos é patrimônio da
-- empresa e esconder contato de vendedor gera cadastro duplicado.
-- A coluna existe para mostrar de quem é e para permitir filtrar.

alter table public.contacts   add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.companies  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists contacts_owner_id_idx  on public.contacts(owner_id);
create index if not exists companies_owner_id_idx on public.companies(owner_id);

-- Backfill: contato herda do negócio vivo mais recente que aponta para ele.
update public.contacts c
   set owner_id = d.owner_id
  from (
    select distinct on (contact_id) contact_id, owner_id
      from public.deals
     where contact_id is not null and deleted_at is null
     order by contact_id, updated_at desc
  ) d
 where d.contact_id = c.id and c.owner_id is null;

-- Empresa herda do contato mais recente ligado a ela.
update public.companies co
   set owner_id = c.owner_id
  from (
    select distinct on (company_id) company_id, owner_id
      from public.contacts
     where company_id is not null and owner_id is not null
     order by company_id, created_at desc
  ) c
 where c.company_id = co.id and co.owner_id is null;
