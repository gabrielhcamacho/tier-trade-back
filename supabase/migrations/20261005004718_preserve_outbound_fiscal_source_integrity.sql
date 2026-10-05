BEGIN;

ALTER TABLE app.fiscal_documents
  ADD COLUMN inventory_dispatch_id uuid;

UPDATE app.fiscal_documents
   SET inventory_dispatch_id=source_id
 WHERE direction='OUTBOUND' AND source_type='INVENTORY_DISPATCH';

ALTER TABLE app.fiscal_documents
  DROP CONSTRAINT fiscal_documents_source_shape,
  ADD CONSTRAINT fiscal_documents_inventory_dispatch_fk
    FOREIGN KEY (tenant_id,inventory_dispatch_id)
    REFERENCES app.inventory_dispatches(tenant_id,id),
  ADD CONSTRAINT fiscal_documents_source_shape CHECK (
    (direction='OUTBOUND' AND source_type='INVENTORY_DISPATCH'
      AND source_id=inventory_dispatch_id AND inventory_dispatch_id IS NOT NULL
      AND sales_contract_id IS NOT NULL AND financial_event_id IS NOT NULL
      AND purchase_contract_id IS NULL AND load_id IS NULL AND load_receipt_id IS NULL
      AND due_date IS NULL AND payable_title_number IS NULL)
    OR
    (direction='INBOUND' AND source_type='LOAD_RECEIPT'
      AND source_id=load_receipt_id AND inventory_dispatch_id IS NULL
      AND purchase_contract_id IS NOT NULL AND load_id IS NOT NULL
      AND load_receipt_id IS NOT NULL AND sales_contract_id IS NULL
      AND financial_event_id IS NOT NULL AND due_date IS NOT NULL
      AND payable_title_number IS NOT NULL)
  );

CREATE INDEX fiscal_documents_inventory_dispatch
  ON app.fiscal_documents (tenant_id,inventory_dispatch_id)
  WHERE inventory_dispatch_id IS NOT NULL;

COMMIT;
