-- WhatsApp via Evolution API.
--
-- One connection (= one Evolution instance) per workspace owner. Every member of
-- that workspace shares it, which is why every policy here is
-- "owner OR is_workspace_member(owner)" rather than a bare auth.uid() check.

-- ---------------------------------------------------------------------------
-- Connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         text NOT NULL DEFAULT 'evolution',
  instance_name    text NOT NULL UNIQUE,
  instance_id      text,
  instance_token   text,          -- encrypted at rest (src/lib/token-crypto.ts)
  webhook_secret   text NOT NULL, -- per-workspace, sent back by Evolution as a header
  status           text NOT NULL DEFAULT 'disconnected',
  phone_number     text,
  profile_name     text,
  profile_pic_url  text,
  qr_code          text,
  qr_expires_at    timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_connections_status_check
    CHECK (status IN ('disconnected', 'connecting', 'open', 'close'))
);

-- This table holds the instance token and the webhook secret, so it is never
-- exposed to the browser: all reads and writes go through server-side routes
-- using the service role. RLS is on with no policies, which denies everyone else.
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_connections FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id          uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  remote_jid             text NOT NULL,
  phone                  text NOT NULL,
  contact_id             uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id                uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  owner_id               uuid,
  push_name              text,
  last_message_at        timestamptz,
  last_message_preview   text,
  last_message_from_me   boolean NOT NULL DEFAULT false,
  unread_count           integer NOT NULL DEFAULT 0,
  manually_unread        boolean NOT NULL DEFAULT false,
  pinned                 boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversations_jid_unique UNIQUE (connection_id, remote_jid)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_user_last_msg_idx
  ON public.whatsapp_conversations (user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_contact_idx
  ON public.whatsapp_conversations (contact_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_deal_idx
  ON public.whatsapp_conversations (deal_id);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversations_select ON public.whatsapp_conversations;
CREATE POLICY whatsapp_conversations_select ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_workspace_member(user_id));

-- Pinning and the manual unread toggle are the only fields the browser writes;
-- everything else is written server-side. The WITH CHECK keeps a member from
-- moving a row into another workspace.
DROP POLICY IF EXISTS whatsapp_conversations_update ON public.whatsapp_conversations;
CREATE POLICY whatsapp_conversations_update ON public.whatsapp_conversations
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_workspace_member(user_id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_workspace_member(user_id));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id    text,
  from_me          boolean NOT NULL,
  type             text NOT NULL DEFAULT 'text',
  body             text,
  media_path       text,
  media_mime       text,
  media_filename   text,
  status           text NOT NULL DEFAULT 'pending',
  error            text,
  sent_by          uuid,
  "timestamp"      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'))
);

-- The webhook can deliver the same event more than once; this is what makes
-- ingestion idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wa_id_unique
  ON public.whatsapp_messages (conversation_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_ts_idx
  ON public.whatsapp_messages (conversation_id, "timestamp");

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_workspace_member(user_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;

-- ---------------------------------------------------------------------------
-- Media storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

-- Objects are written server-side only (service role), always under
-- "<workspace owner uid>/<conversation id>/<uuid>.<ext>". Members read them by
-- minting a signed URL, which is why SELECT is the only policy here.
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;
CREATE POLICY whatsapp_media_workspace_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- Contact matching for inbound messages
-- ---------------------------------------------------------------------------
-- contacts.phones is a jsonb array of {value, type}, and the same person shows
-- up as 553899225622 or 5538999225622 depending on whether the 9th digit is
-- there. Matching on the last 8 digits covers both without a schema change.
CREATE OR REPLACE FUNCTION public.find_contact_by_phone(p_user_id uuid, p_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(c.phones) = 'array' THEN c.phones ELSE '[]'::jsonb END
           ) AS p
      WHERE length(regexp_replace(p->>'value', '\D', '', 'g')) >= 8
        AND right(regexp_replace(p->>'value', '\D', '', 'g'), 8) = right(regexp_replace(p_phone, '\D', '', 'g'), 8)
    )
  ORDER BY c.created_at
  LIMIT 1
$$;

-- Only the service role calls this (from the webhook ingestion path).
REVOKE EXECUTE ON FUNCTION public.find_contact_by_phone(uuid, text) FROM anon, authenticated;
