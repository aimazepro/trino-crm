-- Trava as colunas que só o painel admin (via service-role, que ignora
-- grants de coluna) deve poder escrever. Sem isso, qualquer admin de
-- workspace conseguia reverter uma suspensão ou se auto-conceder uma
-- feature paga direto do navegador -- RLS por linha (is_ws_admin) não
-- limita QUAIS colunas, só QUAIS linhas.
--
-- Verificado contra src/app/configuracoes/empresa/page.tsx (único UPDATE
-- client-side em workspaces hoje): só grava `name` e `updated_at` a partir
-- da sessão do usuário. Nenhuma das colunas abaixo é tocada por esse fluxo,
-- então revogar UPDATE nelas não quebra o salvar de "Empresa".
revoke update (status, plan, feature_flags, owner_user_id, id, created_at)
  on public.workspaces from authenticated;
