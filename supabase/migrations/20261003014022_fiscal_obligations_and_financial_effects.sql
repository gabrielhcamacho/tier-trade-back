BEGIN;

CREATE TABLE app.fiscal_authorities (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  legal_name text NOT NULL CHECK (length(trim(legal_name)) BETWEEN 3 AND 180),
  tax_id text CHECK (tax_id IS NULL OR tax_id ~ '^\d{11,14}$'),
  jurisdiction text NOT NULL CHECK (jurisdiction IN ('FEDERAL','STATE','MUNICIPAL')),
  uf text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE NULLS NOT DISTINCT (tenant_id,jurisdiction,uf,legal_name,tax_id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,updated_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (jurisdiction <> 'STATE' OR uf IS NOT NULL)
);

ALTER TABLE app.fiscal_calculations
  DROP CONSTRAINT fiscal_calculations_source_type_check,
  ADD CONSTRAINT fiscal_calculations_source_type_check
    CHECK (source_type IN ('MANUAL','FISCAL_DOCUMENT','FINANCIAL_EVENT')),
  ADD COLUMN status text NOT NULL DEFAULT 'CALCULATED'
    CHECK (status IN ('CALCULATED','ACCEPTED')),
  ADD COLUMN acceptance_request_key uuid,
  ADD COLUMN acceptance_snapshot jsonb
    CHECK (acceptance_snapshot IS NULL OR jsonb_typeof(acceptance_snapshot)='object'),
  ADD COLUMN accepted_by uuid,
  ADD COLUMN accepted_at timestamptz,
  ADD CONSTRAINT fiscal_calculation_acceptance_state CHECK (
    (status='CALCULATED' AND acceptance_request_key IS NULL AND acceptance_snapshot IS NULL
      AND accepted_by IS NULL AND accepted_at IS NULL)
    OR
    (status='ACCEPTED' AND acceptance_request_key IS NOT NULL AND acceptance_snapshot IS NOT NULL
      AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
  ),
  ADD CONSTRAINT fiscal_calculation_accepted_by_fk
    FOREIGN KEY (tenant_id,accepted_by) REFERENCES app.memberships(tenant_id,user_id),
  ADD CONSTRAINT fiscal_calculation_acceptance_request_unique
    UNIQUE (tenant_id,acceptance_request_key);

CREATE TABLE app.fiscal_obligations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  calculation_id uuid NOT NULL,
  component_tax text NOT NULL CHECK (component_tax IN ('ICMS','PIS','COFINS','FUNRURAL')),
  authority_id uuid NOT NULL,
  competence_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric(24,6) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency='BRL'),
  retained boolean NOT NULL,
  title_effect text NOT NULL CHECK (title_effect IN ('NONE','REDUCE_SOURCE_TITLE')),
  payment_responsibility text NOT NULL CHECK (payment_responsibility IN ('TENANT','COUNTERPARTY')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SETTLED','CANCELLED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,calculation_id,component_tax),
  FOREIGN KEY (tenant_id,calculation_id) REFERENCES app.fiscal_calculations(tenant_id,id),
  FOREIGN KEY (tenant_id,authority_id) REFERENCES app.fiscal_authorities(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (due_date >= competence_date)
);

ALTER TABLE app.financial_events
  DROP CONSTRAINT financial_events_event_type_check,
  DROP CONSTRAINT financial_events_source_type_check,
  DROP CONSTRAINT financial_events_tenant_id_source_id_fkey,
  DROP CONSTRAINT financial_events_quantity_kg_check,
  DROP CONSTRAINT financial_events_unit_price_check,
  ALTER COLUMN sales_contract_id DROP NOT NULL,
  ALTER COLUMN counterparty_id DROP NOT NULL,
  ALTER COLUMN quantity_kg DROP NOT NULL,
  ALTER COLUMN unit_price DROP NOT NULL,
  ADD COLUMN inventory_dispatch_id uuid,
  ADD COLUMN fiscal_obligation_id uuid,
  ADD COLUMN fiscal_authority_id uuid,
  ADD CONSTRAINT financial_events_event_type_check
    CHECK (event_type IN ('SALE_DISPATCH_RECEIVABLE','TAX_OBLIGATION_PAYABLE')),
  ADD CONSTRAINT financial_events_source_type_check
    CHECK (source_type IN ('INVENTORY_DISPATCH','FISCAL_OBLIGATION')),
  ADD CONSTRAINT financial_events_quantity_kg_check
    CHECK (quantity_kg IS NULL OR quantity_kg > 0),
  ADD CONSTRAINT financial_events_unit_price_check
    CHECK (unit_price IS NULL OR unit_price > 0);

UPDATE app.financial_events
   SET inventory_dispatch_id=source_id
 WHERE source_type='INVENTORY_DISPATCH';

ALTER TABLE app.financial_events
  ADD CONSTRAINT financial_events_inventory_dispatch_fk
    FOREIGN KEY (tenant_id,inventory_dispatch_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  ADD CONSTRAINT financial_events_fiscal_obligation_fk
    FOREIGN KEY (tenant_id,fiscal_obligation_id) REFERENCES app.fiscal_obligations(tenant_id,id),
  ADD CONSTRAINT financial_events_fiscal_authority_fk
    FOREIGN KEY (tenant_id,fiscal_authority_id) REFERENCES app.fiscal_authorities(tenant_id,id),
  ADD CONSTRAINT financial_events_source_shape CHECK (
    (event_type='SALE_DISPATCH_RECEIVABLE' AND source_type='INVENTORY_DISPATCH'
      AND source_id=inventory_dispatch_id AND inventory_dispatch_id IS NOT NULL
      AND fiscal_obligation_id IS NULL AND fiscal_authority_id IS NULL
      AND sales_contract_id IS NOT NULL AND counterparty_id IS NOT NULL
      AND direction='INFLOW' AND quantity_kg IS NOT NULL AND unit_price IS NOT NULL)
    OR
    (event_type='TAX_OBLIGATION_PAYABLE' AND source_type='FISCAL_OBLIGATION'
      AND source_id=fiscal_obligation_id AND fiscal_obligation_id IS NOT NULL
      AND fiscal_authority_id IS NOT NULL AND inventory_dispatch_id IS NULL
      AND sales_contract_id IS NULL AND counterparty_id IS NULL
      AND direction='OUTFLOW' AND quantity_kg IS NULL AND unit_price IS NULL)
  );

CREATE TABLE app.financial_title_adjustments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  title_id uuid NOT NULL,
  financial_event_id uuid NOT NULL,
  fiscal_obligation_id uuid NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('FISCAL_RETENTION')),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,fiscal_obligation_id,adjustment_type),
  FOREIGN KEY (tenant_id,title_id) REFERENCES app.financial_titles(tenant_id,id),
  FOREIGN KEY (tenant_id,financial_event_id) REFERENCES app.financial_events(tenant_id,id),
  FOREIGN KEY (tenant_id,fiscal_obligation_id) REFERENCES app.fiscal_obligations(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE INDEX fiscal_authorities_active
  ON app.fiscal_authorities (tenant_id,active,jurisdiction,uf,id);
CREATE INDEX fiscal_authorities_created_by
  ON app.fiscal_authorities (tenant_id,created_by);
CREATE INDEX fiscal_authorities_updated_by
  ON app.fiscal_authorities (tenant_id,updated_by);
CREATE INDEX fiscal_obligations_due_status
  ON app.fiscal_obligations (tenant_id,status,due_date,id);
CREATE INDEX fiscal_obligations_authority
  ON app.fiscal_obligations (tenant_id,authority_id,competence_date,id);
CREATE INDEX fiscal_obligations_created_by
  ON app.fiscal_obligations (tenant_id,created_by);
CREATE INDEX fiscal_calculations_accepted_by
  ON app.fiscal_calculations (tenant_id,accepted_by) WHERE accepted_by IS NOT NULL;
CREATE INDEX financial_events_inventory_dispatch
  ON app.financial_events (tenant_id,inventory_dispatch_id) WHERE inventory_dispatch_id IS NOT NULL;
CREATE INDEX financial_events_fiscal_obligation
  ON app.financial_events (tenant_id,fiscal_obligation_id) WHERE fiscal_obligation_id IS NOT NULL;
CREATE INDEX financial_events_fiscal_authority
  ON app.financial_events (tenant_id,fiscal_authority_id) WHERE fiscal_authority_id IS NOT NULL;
CREATE INDEX financial_title_adjustments_title
  ON app.financial_title_adjustments (tenant_id,title_id,created_at,id);
CREATE INDEX financial_title_adjustments_event
  ON app.financial_title_adjustments (tenant_id,financial_event_id);
CREATE INDEX financial_title_adjustments_created_by
  ON app.financial_title_adjustments (tenant_id,created_by);

ALTER TABLE app.fiscal_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_authorities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_authorities
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.fiscal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_obligations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_obligations
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.financial_title_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.financial_title_adjustments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.financial_title_adjustments
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_finance(p_tenant_id uuid,p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,app
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
  DELETE FROM app.financial_title_adjustments WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_titles WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_events WHERE tenant_id=p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_demo_fiscal_configuration(p_tenant_id uuid,p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,app
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
       AND 'FISCAL_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  DELETE FROM app.fiscal_obligations WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_calculations WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_configuration_versions WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_authorities WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_establishments WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_finance(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.delete_demo_fiscal_configuration(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_authorities TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_obligations TO tier_trade_runtime;
    GRANT UPDATE ON app.fiscal_calculations TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.financial_title_adjustments TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_finance(uuid,uuid) TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_fiscal_configuration(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
