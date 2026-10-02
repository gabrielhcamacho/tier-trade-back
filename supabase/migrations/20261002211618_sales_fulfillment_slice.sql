BEGIN;

CREATE TABLE app.sales_contracts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  reference text NOT NULL CHECK (length(trim(reference)) BETWEEN 3 AND 40),
  commodity text NOT NULL CHECK (commodity IN ('MILHO')),
  quantity_kg numeric(20,3) NOT NULL CHECK (quantity_kg > 0),
  sale_price_per_kg numeric(20,6) NOT NULL CHECK (sale_price_per_kg > 0),
  destination_code text NOT NULL CHECK (destination_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  delivery_start date NOT NULL,
  delivery_end date NOT NULL,
  required_documents text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED','CANCELLED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,reference),
  FOREIGN KEY (tenant_id,counterparty_id) REFERENCES app.counterparties(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (delivery_end >= delivery_start)
);

CREATE TABLE app.inventory_allocations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  quantity_kg numeric(20,3) NOT NULL CHECK (quantity_kg > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','FULFILLED','RELEASED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,sales_contract_id) REFERENCES app.sales_contracts(tenant_id,id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES app.inventory_lots(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.inventory_dispatches (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  allocation_id uuid NOT NULL,
  quantity_kg numeric(20,3) NOT NULL CHECK (quantity_kg > 0),
  dispatched_at timestamptz NOT NULL,
  vehicle_plate text NOT NULL CHECK (vehicle_plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  document_reference text NOT NULL CHECK (length(trim(document_reference)) BETWEEN 1 AND 80),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,allocation_id) REFERENCES app.inventory_allocations(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

ALTER TABLE app.inventory_movements
  ALTER COLUMN source_load_id DROP NOT NULL,
  ALTER COLUMN source_receipt_id DROP NOT NULL,
  ADD COLUMN allocation_id uuid,
  ADD COLUMN dispatch_id uuid,
  DROP CONSTRAINT inventory_movements_movement_type_check,
  ADD CONSTRAINT inventory_movements_movement_type_check
    CHECK (movement_type IN ('RECEIPT','RECEIPT_CORRECTION','RECEIPT_REVERSAL','DISPATCH')),
  ADD FOREIGN KEY (tenant_id,allocation_id) REFERENCES app.inventory_allocations(tenant_id,id),
  ADD FOREIGN KEY (tenant_id,dispatch_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  ADD CONSTRAINT inventory_movement_source_check CHECK (
    (movement_type LIKE 'RECEIPT%' AND source_load_id IS NOT NULL AND source_receipt_id IS NOT NULL
      AND allocation_id IS NULL AND dispatch_id IS NULL)
    OR
    (movement_type='DISPATCH' AND source_load_id IS NULL AND source_receipt_id IS NULL
      AND allocation_id IS NOT NULL AND dispatch_id IS NOT NULL)
  );

CREATE INDEX sales_contracts_status_window ON app.sales_contracts (tenant_id,status,delivery_start,id);
CREATE INDEX sales_contracts_counterparty ON app.sales_contracts (tenant_id,counterparty_id);
CREATE INDEX sales_contracts_created_by ON app.sales_contracts (tenant_id,created_by);
CREATE INDEX inventory_allocations_contract_status ON app.inventory_allocations (tenant_id,sales_contract_id,status,id);
CREATE INDEX inventory_allocations_lot_status ON app.inventory_allocations (tenant_id,lot_id,status,id);
CREATE INDEX inventory_allocations_created_by ON app.inventory_allocations (tenant_id,created_by);
CREATE INDEX inventory_dispatches_allocation_time ON app.inventory_dispatches (tenant_id,allocation_id,dispatched_at,id);
CREATE INDEX inventory_dispatches_created_by ON app.inventory_dispatches (tenant_id,created_by);
CREATE INDEX inventory_movements_allocation ON app.inventory_movements (tenant_id,allocation_id) WHERE allocation_id IS NOT NULL;

ALTER TABLE app.sales_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sales_contracts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.sales_contracts
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.inventory_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.inventory_allocations
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.inventory_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.inventory_dispatches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.inventory_dispatches
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_sales_fulfillment(p_tenant_id uuid,p_actor_id uuid)
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
  DELETE FROM app.inventory_movements WHERE tenant_id=p_tenant_id AND dispatch_id IS NOT NULL;
  DELETE FROM app.inventory_dispatches WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_allocations WHERE tenant_id=p_tenant_id;
  DELETE FROM app.sales_contracts WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_sales_fulfillment(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.sales_contracts TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.inventory_allocations TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.inventory_dispatches TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_sales_fulfillment(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
