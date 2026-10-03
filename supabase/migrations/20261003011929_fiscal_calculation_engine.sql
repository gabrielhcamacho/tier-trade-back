BEGIN;

ALTER TABLE app.fiscal_configuration_versions
  ADD COLUMN rounding_mode text
    CHECK (rounding_mode IS NULL OR rounding_mode IN ('HALF_UP','HALF_EVEN','DOWN','UP')),
  ADD COLUMN rounding_scale smallint
    CHECK (rounding_scale IS NULL OR rounding_scale BETWEEN 0 AND 6),
  ADD CONSTRAINT fiscal_configuration_rounding_pair CHECK (
    (rounding_mode IS NULL AND rounding_scale IS NULL)
    OR (rounding_mode IS NOT NULL AND rounding_scale IS NOT NULL)
  );

CREATE TABLE app.fiscal_calculations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  request_key uuid NOT NULL,
  configuration_id uuid NOT NULL,
  configuration_key uuid NOT NULL,
  configuration_version integer NOT NULL CHECK (configuration_version > 0),
  establishment_id uuid NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('SALE_DISPATCH')),
  commodity text NOT NULL CHECK (length(trim(commodity)) BETWEEN 2 AND 40),
  destination_uf text NOT NULL CHECK (destination_uf ~ '^[A-Z]{2}$'),
  occurred_on date NOT NULL,
  source_type text NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('MANUAL','FISCAL_DOCUMENT')),
  source_id uuid,
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  gross_amount numeric(24,6) NOT NULL CHECK (gross_amount > 0),
  tax_total numeric(24,6) NOT NULL CHECK (tax_total >= 0),
  retained_total numeric(24,6) NOT NULL CHECK (retained_total >= 0),
  net_amount numeric(24,6) NOT NULL CHECK (net_amount >= 0),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot) = 'object'),
  calculated_by uuid NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,request_key),
  FOREIGN KEY (tenant_id,configuration_id)
    REFERENCES app.fiscal_configuration_versions(tenant_id,id),
  FOREIGN KEY (tenant_id,establishment_id)
    REFERENCES app.fiscal_establishments(tenant_id,id),
  FOREIGN KEY (tenant_id,calculated_by)
    REFERENCES app.memberships(tenant_id,user_id)
);

CREATE INDEX fiscal_calculations_configuration
  ON app.fiscal_calculations (tenant_id,configuration_id);
CREATE INDEX fiscal_calculations_establishment_date
  ON app.fiscal_calculations (tenant_id,establishment_id,occurred_on DESC);
CREATE INDEX fiscal_calculations_calculated_by
  ON app.fiscal_calculations (tenant_id,calculated_by);
CREATE INDEX fiscal_calculations_recent
  ON app.fiscal_calculations (tenant_id,calculated_at DESC,id DESC);

ALTER TABLE app.fiscal_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_calculations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_calculations
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_fiscal_configuration(p_tenant_id uuid,p_actor_id uuid)
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
       AND 'FISCAL_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  DELETE FROM app.fiscal_calculations WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_configuration_versions WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_establishments WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_fiscal_configuration(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.fiscal_calculations TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
