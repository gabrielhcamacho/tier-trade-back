BEGIN;

CREATE INDEX financial_events_load
  ON app.financial_events (tenant_id,load_id)
  WHERE load_id IS NOT NULL;

CREATE INDEX fiscal_documents_load
  ON app.fiscal_documents (tenant_id,load_id)
  WHERE load_id IS NOT NULL;

COMMIT;
