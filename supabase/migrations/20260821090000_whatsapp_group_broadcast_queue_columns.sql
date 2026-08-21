-- "Avisar grupo no WhatsApp" sends to a WhatsApp group, not a contact, so the
-- queue needs a group JID (groups have no phone number) and an explicit
-- connection (the number picked in the automation step -- not "the
-- workspace's one connection" that phone-targeted rows fall back to via
-- loadConnection()). Both nullable: existing contact-targeted rows carry
-- neither, and get NULL here.
ALTER TABLE public.automation_whatsapp_queue
  ADD COLUMN connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  ADD COLUMN group_jid text;

COMMENT ON COLUMN public.automation_whatsapp_queue.connection_id IS
  'Which WhatsApp connection to send from. NULL for legacy/contact rows, which resolve the workspace''s connection via loadConnection() instead.';
COMMENT ON COLUMN public.automation_whatsapp_queue.group_jid IS
  'Target group JID (...@g.us) for group-broadcast rows. NULL for contact-targeted rows, which use `phone` instead.';
