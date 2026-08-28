-- P0 — Fecha as funções `security definer` do schema `public` que estavam
-- executáveis pela chave anônima pública (`anon`) em POST /rest/v1/rpc/....
--
-- Duas causas distintas deixaram a porta aberta, e é por isso que
-- `revoke all ... from public` sozinho nunca resolveu o problema todo:
--
--   (a) Grant EXPLÍCITO ao `anon`, que o Supabase concede via
--       ALTER DEFAULT PRIVILEGES no momento do CREATE FUNCTION. Sobrevive a
--       `revoke ... from public`, porque PUBLIC é outro papel.
--       No `proacl` aparece como `anon=X/postgres`.
--         -> claim_due_sequence_enrollments, claim_pending_automation_events,
--            telephony_current_rate
--
--   (b) Grant ao pseudo-papel PUBLIC (`=X/postgres` no `proacl`), que o `anon`
--       herda por ser um papel de login como qualquer outro. Estas nunca
--       tiveram revoke nenhum desde o CREATE.
--         -> telephony_add_credit, telephony_attach_provider_call,
--            telephony_finalize_call, telephony_mark_recording_deleted,
--            telephony_reconcile_stale_calls, telephony_start_call,
--            find_contact_by_phone
--
-- Mesmo padrão de 20260827100700_review_round1_rpc_hardening.sql, que já havia
-- fechado team_scoreboard e sync_my_member_identity.
--
-- O que estava exposto (todas são `security definer`, logo passam por cima da
-- RLS, e todas recebem `workspace_id`/ids como PARÂMETRO forjável):
--
--   telephony_reconcile_stale_calls  sem filtro de workspace: marca como
--                                    `failed` as ligações em andamento de
--                                    TODOS os workspaces de uma vez
--   telephony_add_credit             mexe em saldo e ledger de qualquer workspace
--   telephony_start_call             insere ligação de saída e reserva saldo
--   telephony_finalize_call          fecha ligação e liquida a reserva
--   telephony_attach_provider_call   amarra id do provedor a qualquer ligação
--   telephony_mark_recording_deleted marca gravação de qualquer workspace
--   claim_due_sequence_enrollments   `update ... returning *` sem filtro de
--   claim_pending_automation_events  workspace: vazamento entre inquilinos e
--                                    linhas presas em `processing`
--   find_contact_by_phone            confirma se um telefone existe num
--                                    workspace (não estava no levantamento
--                                    inicial; achada varrendo o `proacl`)
--   telephony_current_rate           vaza a tabela de preços da telefonia
--
-- Também revoga de `authenticated`, não só de `anon`: as dez rodam
-- exclusivamente em rotas de servidor com a chave `service_role`
-- (createAdmin / createTelephonyAdmin em src/lib/whatsapp/connection.ts e
-- src/lib/telephony/db.ts). Nenhuma é chamada do navegador — verificado em
-- todos os `.rpc(` de src/ e supabase/functions/. Deixar `authenticated` seria
-- fechar só metade do buraco: as duas `claim_*` cruzam inquilino, então um
-- vendedor logado de um workspace roubaria a fila de outro.
--
-- Verificado antes de revogar, para não quebrar nada: nenhuma policy de RLS,
-- view ou default de coluna referencia estas funções (aí o EXECUTE seria
-- cobrado do papel que consulta), e os sete jobs do pg_cron rodam como
-- `postgres` e só fazem http_post para a app.
--
-- FICAM COMO ESTÃO — as seis funções de gatilho que também têm `anon=X` no
-- `proacl`: claim_whatsapp_conversation, emit_activity_automation_event,
-- emit_deal_automation_event, on_activity_change, on_contact_change e
-- sync_whatsapp_conversation_links. São inertes: `returns trigger`, e o
-- Postgres recusa a invocação direta com "trigger functions can only be called
-- as triggers" ANTES de qualquer efeito. Mexer nelas é risco sem ganho — o
-- EXECUTE de função de gatilho é cobrado no CREATE TRIGGER, então um revoke
-- aqui não protege nada e ainda quebraria quem recriasse um gatilho depois.

-- (a) grant explícito ao anon + PUBLIC
revoke all on function public.claim_due_sequence_enrollments(integer) from public, anon, authenticated;
revoke all on function public.claim_pending_automation_events(integer) from public, anon, authenticated;
revoke all on function public.telephony_current_rate(uuid, text) from public, anon, authenticated;

-- (b) só PUBLIC
revoke all on function public.find_contact_by_phone(uuid, text) from public, anon, authenticated;
revoke all on function public.telephony_add_credit(uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.telephony_attach_provider_call(uuid, text) from public, anon, authenticated;
revoke all on function public.telephony_finalize_call(text, text, text, integer, timestamp with time zone, timestamp with time zone, text) from public, anon, authenticated;
revoke all on function public.telephony_mark_recording_deleted(uuid) from public, anon, authenticated;
revoke all on function public.telephony_reconcile_stale_calls(interval) from public, anon, authenticated;
revoke all on function public.telephony_start_call(uuid, uuid, uuid, text, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;

-- Reafirma o único papel que deve chamá-las. Já tinham `service_role=X` no
-- `proacl`; explicitar deixa a intenção no arquivo e torna a migration segura
-- de reaplicar.
grant execute on function public.claim_due_sequence_enrollments(integer) to service_role;
grant execute on function public.claim_pending_automation_events(integer) to service_role;
grant execute on function public.telephony_current_rate(uuid, text) to service_role;
grant execute on function public.find_contact_by_phone(uuid, text) to service_role;
grant execute on function public.telephony_add_credit(uuid, bigint, text, uuid, text, text) to service_role;
grant execute on function public.telephony_attach_provider_call(uuid, text) to service_role;
grant execute on function public.telephony_finalize_call(text, text, text, integer, timestamp with time zone, timestamp with time zone, text) to service_role;
grant execute on function public.telephony_mark_recording_deleted(uuid) to service_role;
grant execute on function public.telephony_reconcile_stale_calls(interval) to service_role;
grant execute on function public.telephony_start_call(uuid, uuid, uuid, text, text, text, text, uuid, uuid, uuid) to service_role;
