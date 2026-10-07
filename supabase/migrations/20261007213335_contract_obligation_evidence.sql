-- Evidence is attached to a specific obligation; the document remains owned by its contract.
CREATE TABLE app.contract_obligation_evidence (
  tenant_id uuid NOT NULL,
  obligation_id uuid NOT NULL,
  document_id uuid NOT NULL,
  linked_by uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, obligation_id, document_id),
  FOREIGN KEY (tenant_id, obligation_id) REFERENCES app.contract_obligations(tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES app.documents(tenant_id, id),
  FOREIGN KEY (tenant_id, linked_by) REFERENCES app.memberships(tenant_id, user_id)
);

CREATE INDEX contract_obligation_evidence_document_idx
  ON app.contract_obligation_evidence (tenant_id, document_id);
CREATE INDEX contract_obligation_evidence_linked_by_idx
  ON app.contract_obligation_evidence (tenant_id, linked_by);

ALTER TABLE app.contract_obligation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.contract_obligation_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.contract_obligation_evidence
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT, INSERT ON app.contract_obligation_evidence TO tier_trade_runtime;
  END IF;
END $$;
