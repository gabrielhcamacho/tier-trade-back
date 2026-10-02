BEGIN;

CREATE TABLE app.inventory_locations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.inventory_lots (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  lot_code text NOT NULL CHECK (length(trim(lot_code)) BETWEEN 3 AND 40),
  source_load_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  location_id uuid NOT NULL,
  commodity text NOT NULL CHECK (length(trim(commodity)) BETWEEN 2 AND 40),
  status text NOT NULL CHECK (status IN ('AVAILABLE','BLOCKED_REVIEW')),
  ownership_status text NOT NULL DEFAULT 'PENDING_DEFINITION'
    CHECK (ownership_status IN ('PENDING_DEFINITION','OWN','THIRD_PARTY')),
  risk_status text NOT NULL DEFAULT 'PENDING_DEFINITION'
    CHECK (risk_status IN ('PENDING_DEFINITION','ASSUMED','NOT_ASSUMED')),
  custody_status text NOT NULL DEFAULT 'IN_STORAGE'
    CHECK (custody_status IN ('IN_STORAGE','IN_TRANSIT','RELEASED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,lot_code),
  UNIQUE (tenant_id,source_load_id),
  FOREIGN KEY (tenant_id,source_load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,contract_id) REFERENCES app.contracts(tenant_id,id),
  FOREIGN KEY (tenant_id,location_id) REFERENCES app.inventory_locations(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.inventory_movements (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  lot_id uuid NOT NULL,
  source_load_id uuid NOT NULL,
  source_receipt_id uuid NOT NULL,
  movement_type text NOT NULL
    CHECK (movement_type IN ('RECEIPT','RECEIPT_CORRECTION','RECEIPT_REVERSAL')),
  quantity_delta_kg numeric(20,3) NOT NULL CHECK (quantity_delta_kg <> 0),
  occurred_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,source_receipt_id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES app.inventory_lots(tenant_id,id),
  FOREIGN KEY (tenant_id,source_load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,source_receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE INDEX inventory_locations_created_by ON app.inventory_locations (tenant_id,created_by);
CREATE INDEX inventory_lots_location_status ON app.inventory_lots (tenant_id,location_id,status,lot_code);
CREATE INDEX inventory_lots_contract ON app.inventory_lots (tenant_id,contract_id);
CREATE INDEX inventory_lots_created_by ON app.inventory_lots (tenant_id,created_by);
CREATE INDEX inventory_movements_lot_time ON app.inventory_movements (tenant_id,lot_id,occurred_at,id);
CREATE INDEX inventory_movements_load ON app.inventory_movements (tenant_id,source_load_id);
CREATE INDEX inventory_movements_created_by ON app.inventory_movements (tenant_id,created_by);

ALTER TABLE app.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.inventory_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.inventory_locations
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.inventory_lots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.inventory_lots
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.inventory_movements
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_inventory(p_tenant_id uuid,p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,app
AS $$
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION 'TENANT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND is_demo=true) THEN
    RAISE EXCEPTION 'TENANT_IS_NOT_MARKED_AS_DEMO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.memberships
     WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND active=true
       AND 'OPERATIONS_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;

  DELETE FROM app.inventory_movements WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_lots WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_locations WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_inventory(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.inventory_locations TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.inventory_lots TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.inventory_movements TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_inventory(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
