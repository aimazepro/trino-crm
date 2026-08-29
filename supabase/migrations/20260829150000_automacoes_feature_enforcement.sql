-- Enforcement real de feature flag em automations: até aqui só a UI
-- (RequireFeature) escondia a tela quando `automacoes` estava desligada --
-- a tabela em si aceitava insert/update de qualquer workspace member com
-- is_ws_manager, sem checar o flag. `automations-context.tsx` chama
-- Supabase direto do client (sem rota própria), então o lugar certo pra
-- essa checagem é aqui, na RLS -- não tem route handler no caminho pra
-- rodar assertFeatureEnabled.
--
-- Réplica mínima da lógica de PLAN_DEFAULTS em src/lib/feature-flags.ts:
-- hoje os 3 planos (trial/pro/business) têm `automacoes: true` por
-- default, então só um override explícito `false` desliga. Se um plano
-- futuro mudar esse default, esta função também precisa mudar -- não lê
-- o TS, é uma cópia deliberada (mesma decisão já tomada em várias outras
-- funções deste projeto que replicam checagem client-side em SQL).
create or replace function public.automacoes_enabled(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((feature_flags->>'automacoes')::boolean, true)
  from public.workspaces
  where id = p_workspace_id;
$$;

revoke all on function public.automacoes_enabled(uuid) from public;
grant execute on function public.automacoes_enabled(uuid) to authenticated;

drop policy if exists "automations: insert" on public.automations;
create policy "automations: insert" on public.automations
  for insert
  with check (
    (workspace_id in (select my_workspace_ids()))
    and (select is_ws_manager(automations.workspace_id))
    and public.automacoes_enabled(automations.workspace_id)
  );

drop policy if exists "automations: update" on public.automations;
create policy "automations: update" on public.automations
  for update
  using (
    (workspace_id in (select my_workspace_ids()))
    and (select is_ws_manager(automations.workspace_id))
  )
  with check (
    (workspace_id in (select my_workspace_ids()))
    and (select is_ws_manager(automations.workspace_id))
    and public.automacoes_enabled(automations.workspace_id)
  );

-- DELETE fica sem a checagem de propósito: apagar uma automação com a
-- feature desligada não é um jeito de "usar" o recurso, é limpeza -- não
-- há razão de negócio pra bloquear.
