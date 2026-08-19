-- A conversation's remote_jid is only trustworthy when WhatsApp is the one that
-- produced it. Rows built from a CRM phone number were a guess: contacts are
-- typed without a country code, and Brazilian lines registered before the
-- ninth-digit change answer on a JID that has one fewer digit than the number
-- people write down. Sending to a guessed JID fails with "exists: false".
--
-- This flag marks which rows still need the provider to confirm the JID, so the
-- send route can repair them once instead of guessing again on every message.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS jid_verified boolean NOT NULL DEFAULT false;

-- A row that has ever received an inbound message carries a JID WhatsApp itself
-- sent us, so it is verified by construction.
UPDATE public.whatsapp_conversations c
SET jid_verified = true
WHERE c.jid_verified = false
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_messages m
    WHERE m.conversation_id = c.id
      AND m.from_me = false
  );
