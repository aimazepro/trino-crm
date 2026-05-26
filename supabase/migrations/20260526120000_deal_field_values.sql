CREATE TABLE IF NOT EXISTS deal_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (deal_id, field_id)
);

ALTER TABLE deal_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_field_values_user" ON deal_field_values
  USING (
    EXISTS (
      SELECT 1 FROM deals d WHERE d.id = deal_field_values.deal_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d WHERE d.id = deal_field_values.deal_id AND d.user_id = auth.uid()
    )
  );
