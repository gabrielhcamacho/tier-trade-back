BEGIN;

ALTER TABLE app.outbox_events
  ADD COLUMN available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN lock_owner uuid,
  ADD COLUMN last_error text;

DROP INDEX app.outbox_unpublished;
CREATE INDEX outbox_ready
  ON app.outbox_events (tenant_id, available_at, occurred_at)
  WHERE published_at IS NULL;

CREATE TABLE app.commercial_activity_read_model (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX commercial_activity_recent
  ON app.commercial_activity_read_model (tenant_id, occurred_at DESC, event_id DESC);

CREATE TABLE app.contract_summary_read_model (
  tenant_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  status text NOT NULL,
  commodity text NOT NULL,
  unit text NOT NULL,
  quantity_sc numeric(20,6) NOT NULL,
  delivery_start date NOT NULL,
  delivery_end date NOT NULL,
  purchase_price_per_sc numeric(20,6) NOT NULL,
  sale_reference_per_sc numeric(20,6) NOT NULL,
  total_costs_per_sc numeric(20,6) NOT NULL,
  projected_margin_per_sc numeric(20,6) NOT NULL,
  policy_version integer NOT NULL,
  obligations jsonb NOT NULL,
  source_event_id uuid NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, contract_id),
  UNIQUE (tenant_id, source_event_id)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['commercial_activity_read_model','contract_summary_read_model']
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
