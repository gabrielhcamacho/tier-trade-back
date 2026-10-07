CREATE INDEX commercial_demands_created_by_idx ON app.commercial_demands (tenant_id,created_by);
CREATE INDEX commercial_demands_closed_by_idx ON app.commercial_demands (tenant_id,closed_by)
  WHERE closed_by IS NOT NULL;
CREATE INDEX purchase_contract_terms_created_by_idx ON app.purchase_contract_terms (tenant_id,created_by);
CREATE INDEX purchase_contract_terms_updated_by_idx ON app.purchase_contract_terms (tenant_id,updated_by);

DROP POLICY tenant_isolation ON app.purchase_contract_terms;
CREATE POLICY tenant_isolation ON app.purchase_contract_terms
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);
