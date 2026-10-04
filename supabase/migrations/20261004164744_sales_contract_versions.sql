BEGIN;

-- Technical history of operational sale terms. A version is not proof of signature
-- or a legally accepted addendum; those states require a separate workflow.
CREATE TABLE app.sales_contract_versions (
  tenant_id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  terms jsonb NOT NULL CHECK (jsonb_typeof(terms) = 'object'),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,sales_contract_id,version_number),
  FOREIGN KEY (tenant_id,sales_contract_id)
    REFERENCES app.sales_contracts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,recorded_by)
    REFERENCES app.memberships(tenant_id,user_id)
);

-- Existing operational contracts have no independently verifiable signature
-- evidence. Their current row becomes version 1, with no claim of prior history.
INSERT INTO app.sales_contract_versions
  (tenant_id,sales_contract_id,version_number,terms,recorded_by,recorded_at)
SELECT tenant_id,id,1,
       jsonb_build_object(
         'counterpartyId',counterparty_id,
         'reference',reference,
         'commodity',commodity,
         'quantityKg',quantity_kg::text,
         'salePricePerKg',sale_price_per_kg::text,
         'destinationCode',destination_code,
         'deliveryStart',delivery_start::text,
         'deliveryEnd',delivery_end::text,
         'requiredDocuments',required_documents,
         'paymentTermDays',payment_term_days,
         'status',status),
       created_by,updated_at
  FROM app.sales_contracts;

ALTER TABLE app.sales_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sales_contract_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.sales_contract_versions
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.sales_contract_versions TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
