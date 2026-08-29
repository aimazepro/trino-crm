-- Trava as colunas que só o painel admin (via service-role, que ignora
-- grants de coluna) deve poder escrever. Sem isso, qualquer admin de
-- workspace conseguia reverter uma suspensão ou se auto-conceder uma
-- feature paga direto do navegador -- RLS por linha (is_ws_admin) não
-- limita QUAIS colunas, só QUAIS linhas.
--
-- Verificado contra src/app/configuracoes/empresa/page.tsx (único UPDATE
-- client-side em workspaces hoje): só grava `name`, `slug`, `trial_ends_at`
-- e `updated_at` a partir da sessão do usuário -- essas 4 colunas continuam
-- graváveis por `authenticated` abaixo; nenhuma outra é tocada por esse
-- fluxo hoje.
--
-- NOTA: `authenticated` tinha um GRANT UPDATE de tabela inteira em
-- workspaces (não por coluna) -- um `revoke update (col1, col2, ...)`
-- sozinho não subtrai de um grant de tabela mais amplo, então é preciso
-- revogar o grant de tabela e regrantar só nas colunas que devem continuar
-- graváveis pelo client.
revoke update on public.workspaces from authenticated;
grant update (name, slug, trial_ends_at, updated_at) on public.workspaces to authenticated;
