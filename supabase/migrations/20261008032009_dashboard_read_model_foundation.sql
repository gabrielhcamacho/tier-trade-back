BEGIN;

CREATE TABLE app.dashboard_snapshots (
  tenant_id uuid NOT NULL,
  module text NOT NULL CHECK (module IN (
    'central','commercial','contracts','operations','inventory','risk','financial','fiscal'
  )),
  scope_key text NOT NULL,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  snapshot_version bigint NOT NULL CHECK (snapshot_version > 0),
  source_event_id uuid,
  source_event_occurred_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  build_duration_ms integer NOT NULL DEFAULT 0 CHECK (build_duration_ms >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (tenant_id,module,scope_key)
);

CREATE INDEX dashboard_snapshots_generated
  ON app.dashboard_snapshots (tenant_id,module,generated_at DESC);

CREATE TABLE app.dashboard_refresh_queue (
  tenant_id uuid NOT NULL,
  module text NOT NULL CHECK (module IN (
    'central','commercial','contracts','operations','inventory','risk','financial','fiscal'
  )),
  scope_key text NOT NULL,
  requested_version bigint NOT NULL DEFAULT 1 CHECK (requested_version > 0),
  reason_event_id uuid,
  reason_event_occurred_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lock_owner uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  PRIMARY KEY (tenant_id,module,scope_key),
  CHECK ((locked_at IS NULL) = (lock_owner IS NULL))
);

CREATE INDEX dashboard_refresh_ready
  ON app.dashboard_refresh_queue (tenant_id,available_at,requested_at,module,scope_key)
  WHERE locked_at IS NULL;

CREATE INDEX dashboard_refresh_leases
  ON app.dashboard_refresh_queue (tenant_id,locked_at)
  WHERE locked_at IS NOT NULL;

ALTER TABLE app.dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dashboard_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.dashboard_snapshots
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE app.dashboard_refresh_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dashboard_refresh_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.dashboard_refresh_queue
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON app.dashboard_snapshots TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON app.dashboard_refresh_queue TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
