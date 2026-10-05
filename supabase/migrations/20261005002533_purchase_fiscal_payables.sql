BEGIN;

ALTER TABLE app.financial_events
  DROP CONSTRAINT financial_events_event_type_check,
  DROP CONSTRAINT financial_events_source_type_check,
  DROP CONSTRAINT financial_events_source_shape,
  ADD COLUMN purchase_contract_id uuid,
  ADD COLUMN load_id uuid,
  ADD COLUMN load_receipt_id uuid,
  ADD CONSTRAINT financial_events_event_type_check
    CHECK (event_type IN ('SALE_DISPATCH_RECEIVABLE','TAX_OBLIGATION_PAYABLE','PURCHASE_RECEIPT_PAYABLE')),
  ADD CONSTRAINT financial_events_source_type_check
    CHECK (source_type IN ('INVENTORY_DISPATCH','FISCAL_OBLIGATION','LOAD_RECEIPT')),
  ADD CONSTRAINT financial_events_purchase_contract_fk
    FOREIGN KEY (tenant_id,purchase_contract_id) REFERENCES app.contracts(tenant_id,id),
  ADD CONSTRAINT financial_events_load_fk
    FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  ADD CONSTRAINT financial_events_load_receipt_fk
    FOREIGN KEY (tenant_id,load_receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  ADD CONSTRAINT financial_events_source_shape CHECK (
    (event_type='SALE_DISPATCH_RECEIVABLE' AND source_type='INVENTORY_DISPATCH'
      AND source_id=inventory_dispatch_id AND inventory_dispatch_id IS NOT NULL
      AND fiscal_obligation_id IS NULL AND fiscal_authority_id IS NULL
      AND purchase_contract_id IS NULL AND load_id IS NULL AND load_receipt_id IS NULL
      AND sales_contract_id IS NOT NULL AND counterparty_id IS NOT NULL
      AND direction='INFLOW' AND quantity_kg IS NOT NULL AND unit_price IS NOT NULL)
    OR
    (event_type='TAX_OBLIGATION_PAYABLE' AND source_type='FISCAL_OBLIGATION'
      AND source_id=fiscal_obligation_id AND fiscal_obligation_id IS NOT NULL
      AND fiscal_authority_id IS NOT NULL AND inventory_dispatch_id IS NULL
      AND purchase_contract_id IS NULL AND load_id IS NULL AND load_receipt_id IS NULL
      AND sales_contract_id IS NULL AND counterparty_id IS NULL
      AND direction='OUTFLOW' AND quantity_kg IS NULL AND unit_price IS NULL)
    OR
    (event_type='PURCHASE_RECEIPT_PAYABLE' AND source_type='LOAD_RECEIPT'
      AND source_id=load_receipt_id AND load_receipt_id IS NOT NULL
      AND purchase_contract_id IS NOT NULL AND load_id IS NOT NULL
      AND counterparty_id IS NOT NULL AND direction='OUTFLOW'
      AND quantity_kg IS NOT NULL AND unit_price IS NOT NULL
      AND sales_contract_id IS NULL AND inventory_dispatch_id IS NULL
      AND fiscal_obligation_id IS NULL AND fiscal_authority_id IS NULL)
  );

CREATE INDEX financial_events_purchase_contract_created
  ON app.financial_events (tenant_id,purchase_contract_id,created_at,id)
  WHERE purchase_contract_id IS NOT NULL;
CREATE INDEX financial_events_load_receipt
  ON app.financial_events (tenant_id,load_receipt_id)
  WHERE load_receipt_id IS NOT NULL;

ALTER TABLE app.fiscal_documents
  DROP CONSTRAINT fiscal_documents_direction_check,
  DROP CONSTRAINT fiscal_documents_source_type_check,
  DROP CONSTRAINT fiscal_documents_tenant_id_source_id_fkey,
  ALTER COLUMN sales_contract_id DROP NOT NULL,
  ALTER COLUMN financial_event_id DROP NOT NULL,
  ADD COLUMN purchase_contract_id uuid,
  ADD COLUMN load_id uuid,
  ADD COLUMN load_receipt_id uuid,
  ADD COLUMN due_date date,
  ADD COLUMN payable_title_number text,
  ADD CONSTRAINT fiscal_documents_direction_check CHECK (direction IN ('OUTBOUND','INBOUND')),
  ADD CONSTRAINT fiscal_documents_source_type_check CHECK (source_type IN ('INVENTORY_DISPATCH','LOAD_RECEIPT')),
  ADD CONSTRAINT fiscal_documents_purchase_contract_fk
    FOREIGN KEY (tenant_id,purchase_contract_id) REFERENCES app.contracts(tenant_id,id),
  ADD CONSTRAINT fiscal_documents_load_fk
    FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  ADD CONSTRAINT fiscal_documents_load_receipt_fk
    FOREIGN KEY (tenant_id,load_receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  ADD CONSTRAINT fiscal_documents_due_date_valid CHECK (due_date IS NULL OR due_date >= issued_at::date),
  ADD CONSTRAINT fiscal_documents_payable_title_number_valid
    CHECK (payable_title_number IS NULL OR length(trim(payable_title_number)) BETWEEN 3 AND 40),
  ADD CONSTRAINT fiscal_documents_source_shape CHECK (
    (direction='OUTBOUND' AND source_type='INVENTORY_DISPATCH'
      AND sales_contract_id IS NOT NULL AND financial_event_id IS NOT NULL
      AND purchase_contract_id IS NULL AND load_id IS NULL AND load_receipt_id IS NULL
      AND due_date IS NULL AND payable_title_number IS NULL)
    OR
    (direction='INBOUND' AND source_type='LOAD_RECEIPT'
      AND source_id=load_receipt_id AND purchase_contract_id IS NOT NULL
      AND load_id IS NOT NULL AND load_receipt_id IS NOT NULL
      AND sales_contract_id IS NULL AND financial_event_id IS NOT NULL
      AND due_date IS NOT NULL AND payable_title_number IS NOT NULL)
  );

CREATE INDEX fiscal_documents_purchase_contract_issued
  ON app.fiscal_documents (tenant_id,purchase_contract_id,issued_at,id)
  WHERE purchase_contract_id IS NOT NULL;
CREATE INDEX fiscal_documents_load_receipt
  ON app.fiscal_documents (tenant_id,load_receipt_id)
  WHERE load_receipt_id IS NOT NULL;

ALTER TABLE app.financial_payments
  ALTER COLUMN fiscal_obligation_id DROP NOT NULL,
  ADD COLUMN purchase_receipt_id uuid,
  ADD CONSTRAINT financial_payments_purchase_receipt_fk
    FOREIGN KEY (tenant_id,purchase_receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  ADD CONSTRAINT financial_payments_source_shape CHECK (
    (fiscal_obligation_id IS NOT NULL AND purchase_receipt_id IS NULL)
    OR (fiscal_obligation_id IS NULL AND purchase_receipt_id IS NOT NULL)
  );

CREATE INDEX financial_payments_purchase_receipt
  ON app.financial_payments (tenant_id,purchase_receipt_id,paid_at,id)
  WHERE purchase_receipt_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_documents TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.financial_events TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.financial_titles TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.financial_payments TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
