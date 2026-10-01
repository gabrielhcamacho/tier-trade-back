BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

ALTER TABLE app.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON app.tenants;
CREATE POLICY tenant_isolation ON app.tenants
  USING (id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid))
  WITH CHECK (id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid));

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
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = (SELECT nullif(current_setting(''app.tenant_id'', true), '''')::uuid)) WITH CHECK (tenant_id = (SELECT nullif(current_setting(''app.tenant_id'', true), '''')::uuid))',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
