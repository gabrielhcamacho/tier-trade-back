CREATE TABLE app.bank_statement_imports (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  source_format text NOT NULL CHECK (source_format IN ('TIER_TRADE_CSV','NORMALIZED_JSON','OFX','CNAB240','CNAB400')),
  original_file_name text CHECK (original_file_name IS NULL OR length(trim(original_file_name)) BETWEEN 1 AND 255),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  adapter_version text NOT NULL CHECK (length(trim(adapter_version)) BETWEEN 1 AND 40),
  imported_count integer NOT NULL CHECK (imported_count >= 0),
  skipped_count integer NOT NULL CHECK (skipped_count >= 0),
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(mapping)='object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,bank_account_id,content_sha256),
  FOREIGN KEY (tenant_id,bank_account_id) REFERENCES app.bank_accounts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

ALTER TABLE app.bank_statement_entries
  ADD COLUMN import_id uuid,
  ADD COLUMN source_line_number integer,
  ADD COLUMN fingerprint text;

ALTER TABLE app.bank_statement_entries
  ADD CONSTRAINT bank_statement_entries_import_fk
  FOREIGN KEY (tenant_id,import_id) REFERENCES app.bank_statement_imports(tenant_id,id),
  ADD CONSTRAINT bank_statement_entries_source_line_check
  CHECK (source_line_number IS NULL OR source_line_number > 0),
  ADD CONSTRAINT bank_statement_entries_import_metadata_check
  CHECK ((import_id IS NULL AND source_line_number IS NULL AND fingerprint IS NULL)
      OR (import_id IS NOT NULL AND source_line_number IS NOT NULL AND fingerprint IS NOT NULL));

CREATE UNIQUE INDEX bank_statement_entries_fingerprint_unique
  ON app.bank_statement_entries (tenant_id,bank_account_id,fingerprint)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX bank_statement_imports_created_at
  ON app.bank_statement_imports (tenant_id,created_at DESC,id);
CREATE INDEX bank_statement_imports_created_by
  ON app.bank_statement_imports (tenant_id,created_by);
CREATE INDEX bank_statement_entries_import_id
  ON app.bank_statement_entries (tenant_id,import_id)
  WHERE import_id IS NOT NULL;

ALTER TABLE app.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.bank_statement_imports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.bank_statement_imports
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.bank_statement_imports TO tier_trade_runtime;
  END IF;
END $$;
