BEGIN;

DROP POLICY tenant_isolation ON app.dashboard_snapshots;
CREATE POLICY tenant_isolation ON app.dashboard_snapshots
  USING (tenant_id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid))
  WITH CHECK (tenant_id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid));

DROP POLICY tenant_isolation ON app.dashboard_refresh_queue;
CREATE POLICY tenant_isolation ON app.dashboard_refresh_queue
  USING (tenant_id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid))
  WITH CHECK (tenant_id = (SELECT nullif(current_setting('app.tenant_id', true), '')::uuid));

COMMIT;
