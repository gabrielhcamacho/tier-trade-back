BEGIN;

CREATE INDEX fiscal_documents_source
  ON app.fiscal_documents (tenant_id,source_id);

COMMIT;
