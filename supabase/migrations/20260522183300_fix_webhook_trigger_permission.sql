-- Elevate the on_deal_change trigger function to SECURITY DEFINER
-- so it can execute enqueue_webhook_delivery which had its execution
-- restricted in the previous security hardening migration.
ALTER FUNCTION public.on_deal_change() SECURITY DEFINER;
