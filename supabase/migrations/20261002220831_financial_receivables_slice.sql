BEGIN;

ALTER TABLE app.sales_contracts
  ADD COLUMN payment_term_days integer
    CHECK (payment_term_days IS NULL OR payment_term_days BETWEEN 0 AND 730);

CREATE TABLE app.financial_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('SALE_DISPATCH_RECEIVABLE')),
  source_type text NOT NULL CHECK (source_type IN ('INVENTORY_DISPATCH')),
  source_id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('INFLOW','OUTFLOW')),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  quantity_kg numeric(20,3) NOT NULL CHECK (quantity_kg > 0),
  unit_price numeric(20,6) NOT NULL CHECK (unit_price > 0),
  raw_amount numeric(30,9) NOT NULL CHECK (raw_amount > 0),
  calculated_amount numeric(20,2),
  calculation_status text NOT NULL
    CHECK (calculation_status IN ('READY','PENDING_ROUNDING_POLICY')),
  expected_on date,
  formula_code text NOT NULL,
  formula_version integer NOT NULL CHECK (formula_version > 0),
  calculation_memory jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,source_type,source_id,event_type),
  FOREIGN KEY (tenant_id,source_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  FOREIGN KEY (tenant_id,sales_contract_id) REFERENCES app.sales_contracts(tenant_id,id),
  FOREIGN KEY (tenant_id,counterparty_id) REFERENCES app.counterparties(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (calculation_status='READY' AND calculated_amount IS NOT NULL)
    OR (calculation_status='PENDING_ROUNDING_POLICY' AND calculated_amount IS NULL)
  )
);

CREATE TABLE app.financial_titles (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  financial_event_id uuid NOT NULL,
  title_number text NOT NULL CHECK (length(trim(title_number)) BETWEEN 3 AND 40),
  document_reference text NOT NULL CHECK (length(trim(document_reference)) BETWEEN 1 AND 80),
  due_date date NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','PARTIALLY_SETTLED','SETTLED')),
  issued_by uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,financial_event_id),
  UNIQUE (tenant_id,title_number),
  FOREIGN KEY (tenant_id,financial_event_id) REFERENCES app.financial_events(tenant_id,id),
  FOREIGN KEY (tenant_id,issued_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.financial_settlements (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  title_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  received_at timestamptz NOT NULL,
  bank_reference text NOT NULL CHECK (length(trim(bank_reference)) BETWEEN 1 AND 80),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,bank_reference),
  FOREIGN KEY (tenant_id,title_id) REFERENCES app.financial_titles(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,reversed_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR
    (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND length(trim(reversal_reason)) BETWEEN 3 AND 500)
  )
);

CREATE INDEX financial_events_contract_created
  ON app.financial_events (tenant_id,sales_contract_id,created_at,id);
CREATE INDEX financial_events_expected
  ON app.financial_events (tenant_id,expected_on,id);
CREATE INDEX financial_events_counterparty
  ON app.financial_events (tenant_id,counterparty_id);
CREATE INDEX financial_titles_due_status
  ON app.financial_titles (tenant_id,status,due_date,id);
CREATE INDEX financial_titles_issued_by
  ON app.financial_titles (tenant_id,issued_by);
CREATE INDEX financial_settlements_title_received
  ON app.financial_settlements (tenant_id,title_id,received_at,id);
CREATE INDEX financial_settlements_created_by
  ON app.financial_settlements (tenant_id,created_by);
CREATE INDEX financial_settlements_reversed_by
  ON app.financial_settlements (tenant_id,reversed_by) WHERE reversed_by IS NOT NULL;

ALTER TABLE app.financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.financial_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.financial_events
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.financial_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.financial_titles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.financial_titles
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.financial_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.financial_settlements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.financial_settlements
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_finance(p_tenant_id uuid,p_actor_id uuid)
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
       AND 'FINANCE_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  DELETE FROM app.financial_settlements WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_titles WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_events WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_finance(uuid,uuid) FROM PUBLIC;

UPDATE app.memberships m
   SET capabilities=array_append(m.capabilities,'FINANCE_EDIT')
  FROM app.tenants t
 WHERE t.id=m.tenant_id AND t.is_demo=true
   AND NOT ('FINANCE_EDIT'=ANY(m.capabilities));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.financial_events TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.financial_titles TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.financial_settlements TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_finance(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
