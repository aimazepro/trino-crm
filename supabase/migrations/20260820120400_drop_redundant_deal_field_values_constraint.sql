-- Drop the redundant unique constraint; the original deal_field_values_deal_id_field_id_key
-- already enforces the same (deal_id, field_id) uniqueness and is sufficient for upsert targeting.
ALTER TABLE public.deal_field_values
  DROP CONSTRAINT deal_field_values_deal_field_unique;
