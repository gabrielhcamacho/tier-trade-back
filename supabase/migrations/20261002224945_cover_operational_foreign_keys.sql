BEGIN;

CREATE INDEX financial_events_created_by
  ON app.financial_events (tenant_id,created_by);
CREATE INDEX financial_events_source
  ON app.financial_events (tenant_id,source_id);
CREATE INDEX inventory_movements_dispatch
  ON app.inventory_movements (tenant_id,dispatch_id)
  WHERE dispatch_id IS NOT NULL;

COMMIT;
