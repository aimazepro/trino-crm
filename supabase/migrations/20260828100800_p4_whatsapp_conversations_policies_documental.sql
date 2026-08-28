-- P4 — Migration puramente DOCUMENTAL. Não muda nada.
--
-- As policies vivas de `whatsapp_conversations` vêm de uma migration chamada
-- `phase1_multitenancy`, que **não tem `.sql` neste repositório**. Quem lia
-- só os arquivos daqui não encontrava regra nenhuma para a tabela e já tirou
-- conclusão errada sobre a RLS dela. Este arquivo transcreve o que o banco
-- realmente tem, lido de `pg_policy` em 2026-08-28, para que o repositório
-- pare de mentir por omissão.
--
-- Reaplicar isto num banco limpo produz exatamente as policies de produção.
-- Num banco que já as tem, é no-op (o `drop policy if exists` recria idêntico).
--
-- Nota de contexto para quem for procurar: os nomes de arquivo em
-- `supabase/migrations/` **não batem** com as versões em
-- `supabase_migrations.schema_migrations` -- o MCP gera o próprio timestamp
-- ao aplicar. O drift é antigo e cosmético, mas confunde.

drop policy if exists "whatsapp_conversations: select" on public.whatsapp_conversations;
create policy "whatsapp_conversations: select" on public.whatsapp_conversations
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      owner_id = (select auth.uid())
      or (select public.is_ws_manager(whatsapp_conversations.workspace_id))
      -- Conversa sem dono é a "fila": visível para todos até alguém assumir.
      or owner_id is null
    )
  );

drop policy if exists "whatsapp_conversations: insert" on public.whatsapp_conversations;
create policy "whatsapp_conversations: insert" on public.whatsapp_conversations
  for insert with check (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "whatsapp_conversations: update" on public.whatsapp_conversations;
create policy "whatsapp_conversations: update" on public.whatsapp_conversations
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (
      owner_id = (select auth.uid())
      or (select public.is_ws_manager(whatsapp_conversations.workspace_id))
      or owner_id is null
    )
  ) with check (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "whatsapp_conversations: delete" on public.whatsapp_conversations;
create policy "whatsapp_conversations: delete" on public.whatsapp_conversations
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (select public.is_ws_manager(whatsapp_conversations.workspace_id))
  );
