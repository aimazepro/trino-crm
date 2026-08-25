-- Groups were unconditionally dropped: at instance creation (groupsIgnore:
-- true in evolution.ts createInstance) and again at ingestion, belt-and-braces
-- (normalizeUpsert). This makes it a per-workspace choice instead of a
-- hardcoded one. Default false keeps today's behavior for every existing
-- connection until someone opts in from Configuracoes > WhatsApp; the app
-- also pushes the flag to Evolution's own /settings/set the first time it's
-- flipped, since a live instance still has groupsIgnore baked in from creation.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS groups_enabled boolean NOT NULL DEFAULT false;
