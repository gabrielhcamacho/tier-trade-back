BEGIN;

CREATE TABLE app.loads (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  contract_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  expected_weight_kg numeric(20,3) NOT NULL CHECK (expected_weight_kg > 0),
  vehicle_plate text NOT NULL CHECK (vehicle_plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  carrier_name text NOT NULL CHECK (length(trim(carrier_name)) BETWEEN 2 AND 200),
  destination_code text NOT NULL CHECK (destination_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  status text NOT NULL CHECK (status IN ('SCHEDULED','IN_RECEIVING','RECEIVED','CANCELLED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,contract_id) REFERENCES app.contracts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE INDEX loads_contract_schedule
  ON app.loads (tenant_id,contract_id,scheduled_at,id)
  WHERE status <> 'CANCELLED';
CREATE INDEX loads_created_by ON app.loads (tenant_id,created_by);

ALTER TABLE app.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.loads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.loads
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

COMMIT;
