-- Formal terms supplement the approved offer; economic values and delivery dates remain owned by the offer.
CREATE TABLE app.purchase_contract_terms (
  tenant_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  external_number text NOT NULL CHECK (char_length(btrim(external_number)) BETWEEN 1 AND 80),
  crop_year text NOT NULL CHECK (char_length(btrim(crop_year)) BETWEEN 3 AND 30),
  signed_on date,
  pickup_location text CHECK (pickup_location IS NULL OR char_length(btrim(pickup_location)) BETWEEN 3 AND 240),
  delivery_condition text CHECK (delivery_condition IS NULL OR char_length(btrim(delivery_condition)) BETWEEN 3 AND 160),
  freight_payer text CHECK (freight_payer IN ('BUYER','SELLER','THIRD_PARTY')),
  weighing_responsibility text CHECK (weighing_responsibility IS NULL OR char_length(btrim(weighing_responsibility)) BETWEEN 3 AND 240),
  quality_terms text CHECK (quality_terms IS NULL OR char_length(btrim(quality_terms)) BETWEEN 3 AND 2000),
  required_documents text CHECK (required_documents IS NULL OR char_length(btrim(required_documents)) BETWEEN 3 AND 2000),
  payment_terms text CHECK (payment_terms IS NULL OR char_length(btrim(payment_terms)) BETWEEN 3 AND 2000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, contract_id),
  FOREIGN KEY (tenant_id, contract_id) REFERENCES app.contracts(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, created_by) REFERENCES app.memberships(tenant_id, user_id),
  FOREIGN KEY (tenant_id, updated_by) REFERENCES app.memberships(tenant_id, user_id)
);

ALTER TABLE app.purchase_contract_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.purchase_contract_terms FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.purchase_contract_terms
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON app.purchase_contract_terms TO tier_trade_runtime;
  END IF;
END $$;
