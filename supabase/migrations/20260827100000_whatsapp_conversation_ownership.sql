-- supabase/migrations/20260827100000_whatsapp_conversation_ownership.sql
--
-- Dono de conversa passa a ser de quem atendeu, não do dono do negócio.
--
-- Duas mudanças que só fazem sentido juntas:
--   1. auto-claim: a primeira resposta humana numa conversa órfã a reivindica;
--   2. sync_whatsapp_conversation_links para de sobrescrever esse dono.
-- Sem (2), o (1) seria desfeito no próximo vínculo de negócio ao contato.

-- 1. Auto-claim -------------------------------------------------------------

create or replace function public.claim_whatsapp_conversation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Só mensagem de gente reivindica. A fila de automação envia com sent_by
  -- nulo justamente para que um robô nunca tire um lead da fila.
  if new.from_me is true and new.sent_by is not null then
    update public.whatsapp_conversations
       set owner_id = new.sent_by,
           updated_at = now()
     where id = new.conversation_id
       and owner_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_autoclaim_conversation on public.whatsapp_messages;
create trigger whatsapp_messages_autoclaim_conversation
  after insert on public.whatsapp_messages
  for each row
  execute function public.claim_whatsapp_conversation();

-- 2. sync deixa de ser autoridade sobre o dono -------------------------------

create or replace function public.sync_whatsapp_conversation_links()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH best AS (
    SELECT id, owner_id
    FROM public.deals
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND deleted_at IS NULL
    ORDER BY (status = 'Ativo') DESC, updated_at DESC
    LIMIT 1
  )
  UPDATE public.whatsapp_conversations c
  SET deal_id = best.id,
      -- COALESCE: quem atendeu continua dono. O negócio só preenche o vazio.
      owner_id = COALESCE(c.owner_id, best.owner_id),
      updated_at = now()
  FROM best
  WHERE c.workspace_id = NEW.workspace_id
    AND c.contact_id = NEW.contact_id
    AND (c.deal_id IS DISTINCT FROM best.id
         OR c.owner_id IS DISTINCT FROM COALESCE(c.owner_id, best.owner_id));

  -- Contato sem nenhum negócio vivo: o vínculo com o negócio deixa de valer,
  -- mas o dono NÃO é zerado. Perder o negócio não devolve a conversa para a
  -- fila -- quem vinha atendendo continua atendendo.
  IF NOT EXISTS (
    SELECT 1 FROM public.deals
    WHERE workspace_id = NEW.workspace_id AND contact_id = NEW.contact_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.whatsapp_conversations
    SET deal_id = NULL, updated_at = now()
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND deal_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;
