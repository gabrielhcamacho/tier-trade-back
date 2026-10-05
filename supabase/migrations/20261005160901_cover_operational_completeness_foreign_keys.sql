BEGIN;

CREATE INDEX inventory_lot_events_lot_time
  ON app.inventory_lot_events (tenant_id,lot_id,occurred_at DESC,id DESC);
CREATE INDEX inventory_lot_events_created_by
  ON app.inventory_lot_events (tenant_id,created_by);
CREATE INDEX inventory_transfers_source_location
  ON app.inventory_transfers (tenant_id,source_location_id);
CREATE INDEX inventory_transfers_destination_location
  ON app.inventory_transfers (tenant_id,destination_location_id);
CREATE INDEX inventory_transfers_created_by
  ON app.inventory_transfers (tenant_id,created_by);
CREATE INDEX inventory_counts_lot_time
  ON app.inventory_counts (tenant_id,lot_id,occurred_at DESC,id DESC);
CREATE INDEX inventory_counts_created_by
  ON app.inventory_counts (tenant_id,created_by);
CREATE INDEX commission_policies_created_by
  ON app.commission_policies (tenant_id,created_by);
CREATE INDEX commission_accruals_financial_event
  ON app.commission_accruals (tenant_id,financial_event_id);
CREATE INDEX commission_accruals_created_by
  ON app.commission_accruals (tenant_id,created_by);
CREATE INDEX documents_created_by
  ON app.documents (tenant_id,created_by);
CREATE INDEX document_signatures_created_by
  ON app.document_signatures (tenant_id,created_by);

COMMIT;
