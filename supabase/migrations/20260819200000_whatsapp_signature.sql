-- Optional signature prefixed to outgoing messages, the way Chatwoot and the
-- Evolution panel do it. A shared workspace instance sends from one number, so
-- without this the person on the other end cannot tell which member of the team
-- is writing.
--
-- Off by default: turning it on changes what every customer receives, and that
-- is the owner's call, not a default we make for them.

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS signature_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_name text;
