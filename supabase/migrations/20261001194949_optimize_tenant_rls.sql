BEGIN;

DROP POLICY IF EXISTS tenant_isolation ON app.tenants;
CREATE POLICY tenant_isolation ON app.tenants
  USING (id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships',
    'counterparties',
    'margin_policies',
    'offers',
    'pricing_scenarios',
    'approvals',
    'contracts',
    'contract_obligations',
    'audit_events',
    'outbox_events',
    'commercial_activity_read_model',
    'contract_summary_read_model'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON app.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = nullif((SELECT current_setting(''app.tenant_id'', true)), '''')::uuid) WITH CHECK (tenant_id = nullif((SELECT current_setting(''app.tenant_id'', true)), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
