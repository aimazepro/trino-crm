-- P4 — `sync_my_member_identity` aceitava nome vazio.
--
-- `coalesce(p_name, name)` não protege de string vazia: '' não é null, então
-- a função gravava nome em branco e ainda devolvia 1, como se tivesse
-- sincronizado. O cliente já fazia `trim` antes de chamar, mas validação que
-- só existe no cliente é contornável pelo devtools -- foi assim que o QR do
-- WhatsApp vazou nesta branch. O gate tem que estar nas duas camadas.
--
-- A regra do nome ficou igual à que a função já aplicava ao avatar: valor
-- fornecido e reprovado devolve 0, em vez de um no-op que se passa por
-- sucesso.
--
-- `create or replace` de propósito, não `drop` + `create`: todo `drop
-- function` desfaz o revoke de anon do P0, e refazê-lo aqui seria mais uma
-- chance de esquecer. Conferido depois de aplicar -- o ACL segue
-- {postgres=X, authenticated=X, service_role=X}, sem anon.

create or replace function public.sync_my_member_identity(p_name text default null::text, p_avatar_url text default null::text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  n int;
  v_avatar text;
  v_name text;
begin
  v_avatar := case
    when p_avatar_url is null then null
    when p_avatar_url like 'https://etdkzpiehoivrviylemd.supabase.co/storage/v1/object/public/avatars/%' then p_avatar_url
    else null
  end;

  if p_avatar_url is not null and v_avatar is null then
    return 0;
  end if;

  v_name := nullif(btrim(p_name), '');
  if p_name is not null and v_name is null then
    return 0;
  end if;

  update public.workspace_members
     set name = coalesce(v_name, name),
         avatar_url = coalesce(v_avatar, avatar_url)
   where member_user_id = auth.uid()
     and status = 'accepted';

  get diagnostics n = row_count;
  return n;
end;
$function$;
