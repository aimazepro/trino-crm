ALTER TABLE public.deal_field_values
  ADD CONSTRAINT deal_field_values_deal_field_unique UNIQUE (deal_id, field_id);
