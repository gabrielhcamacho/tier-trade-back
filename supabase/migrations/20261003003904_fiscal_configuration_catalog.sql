BEGIN;

CREATE TABLE app.fiscal_establishments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  legal_name text NOT NULL CHECK (length(trim(legal_name)) BETWEEN 3 AND 180),
  tax_id text NOT NULL CHECK (tax_id ~ '^[0-9]{14}$'),
  state_registration text CHECK (state_registration IS NULL OR length(trim(state_registration)) BETWEEN 2 AND 30),
  uf text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  tax_regime text CHECK (tax_regime IS NULL OR tax_regime IN ('SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,tax_id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,updated_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE INDEX fiscal_establishments_created_by ON app.fiscal_establishments (tenant_id,created_by);
CREATE INDEX fiscal_establishments_updated_by ON app.fiscal_establishments (tenant_id,updated_by);

CREATE TABLE app.fiscal_configuration_versions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  configuration_key uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  establishment_id uuid,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
  operation_type text NOT NULL DEFAULT 'SALE_DISPATCH' CHECK (operation_type IN ('SALE_DISPATCH')),
  commodity text CHECK (commodity IS NULL OR length(trim(commodity)) BETWEEN 2 AND 40),
  destination_uf text CHECK (destination_uf IS NULL OR destination_uf ~ '^[A-Z]{2}$'),
  cfop text CHECK (cfop IS NULL OR cfop ~ '^[0-9]{4}$'),
  emission_strategy text CHECK (emission_strategy IS NULL OR emission_strategy IN ('NATIVE','INTEGRATED')),
  technical_responsible text CHECK (technical_responsible IS NULL OR length(trim(technical_responsible)) BETWEEN 3 AND 160),
  effective_from date,
  effective_to date,
  tax_components jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tax_components)='array'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid,
  activated_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,configuration_key,version),
  FOREIGN KEY (tenant_id,establishment_id) REFERENCES app.fiscal_establishments(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,updated_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,activated_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CHECK (
    (status='DRAFT' AND activated_by IS NULL AND activated_at IS NULL)
    OR (status IN ('ACTIVE','RETIRED') AND activated_by IS NOT NULL AND activated_at IS NOT NULL)
  )
);

CREATE INDEX fiscal_configurations_establishment
  ON app.fiscal_configuration_versions (tenant_id,establishment_id);
CREATE INDEX fiscal_configurations_created_by
  ON app.fiscal_configuration_versions (tenant_id,created_by);
CREATE INDEX fiscal_configurations_updated_by
  ON app.fiscal_configuration_versions (tenant_id,updated_by);
CREATE INDEX fiscal_configurations_activated_by
  ON app.fiscal_configuration_versions (tenant_id,activated_by) WHERE activated_by IS NOT NULL;
CREATE INDEX fiscal_configurations_active_lookup
  ON app.fiscal_configuration_versions
    (tenant_id,establishment_id,operation_type,commodity,destination_uf,effective_from,effective_to)
  WHERE status='ACTIVE';

ALTER TABLE app.fiscal_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_establishments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_establishments
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.fiscal_configuration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_configuration_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_configuration_versions
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
  DELETE FROM app.fiscal_configuration_versions WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_establishments WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_fiscal_configuration(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_establishments TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_configuration_versions TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_fiscal_configuration(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
