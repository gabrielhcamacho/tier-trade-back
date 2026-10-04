CREATE INDEX IF NOT EXISTS sales_contract_versions_tenant_recorded_by
  ON app.sales_contract_versions (tenant_id, recorded_by);
