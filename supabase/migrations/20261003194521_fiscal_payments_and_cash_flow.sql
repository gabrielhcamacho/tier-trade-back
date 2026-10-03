BEGIN;

ALTER TABLE app.fiscal_obligations
  DROP CONSTRAINT fiscal_obligations_status_check,
  ADD CONSTRAINT fiscal_obligations_status_check
    CHECK (status IN ('OPEN','PARTIALLY_SETTLED','SETTLED','CANCELLED'));

CREATE TABLE app.financial_payments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  title_id uuid NOT NULL,
  fiscal_obligation_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL,
  bank_reference text NOT NULL CHECK (length(trim(bank_reference)) BETWEEN 1 AND 80),
  notes text CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text CHECK (reversal_reason IS NULL OR length(trim(reversal_reason)) BETWEEN 3 AND 500),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,bank_reference),
  FOREIGN KEY (tenant_id,title_id) REFERENCES app.financial_titles(tenant_id,id),
  FOREIGN KEY (tenant_id,fiscal_obligation_id) REFERENCES app.fiscal_obligations(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,reversed_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR
    (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL)
  )
);

CREATE INDEX financial_payments_title
  ON app.financial_payments (tenant_id,title_id,paid_at,id);
CREATE INDEX financial_payments_obligation
  ON app.financial_payments (tenant_id,fiscal_obligation_id,paid_at,id);
CREATE INDEX financial_payments_created_by
  ON app.financial_payments (tenant_id,created_by);
CREATE INDEX financial_payments_reversed_by
  ON app.financial_payments (tenant_id,reversed_by) WHERE reversed_by IS NOT NULL;

ALTER TABLE app.financial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.financial_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.financial_payments
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
  DELETE FROM app.financial_payments WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_settlements WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_title_adjustments WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_titles WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_events WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_finance(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.financial_payments TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_finance(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
