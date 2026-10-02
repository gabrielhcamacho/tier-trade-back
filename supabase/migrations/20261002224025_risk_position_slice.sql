BEGIN;

CREATE TABLE app.risk_policies (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  commodity text NOT NULL CHECK (commodity IN ('MILHO')),
  version integer NOT NULL CHECK (version > 0),
  max_net_open_kg numeric(20,3) NOT NULL CHECK (max_net_open_kg > 0),
  warning_threshold_pct numeric(5,2) NOT NULL CHECK (warning_threshold_pct > 0 AND warning_threshold_pct <= 100),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,commodity,version),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE UNIQUE INDEX risk_policies_one_active_per_commodity
  ON app.risk_policies (tenant_id,commodity) WHERE active;
CREATE INDEX risk_policies_created_by
  ON app.risk_policies (tenant_id,created_by);

ALTER TABLE app.risk_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.risk_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.risk_policies
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_risk(p_tenant_id uuid,p_actor_id uuid)
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
       AND 'RISK_MANAGE'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  DELETE FROM app.risk_policies WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_risk(uuid,uuid) FROM PUBLIC;

UPDATE app.memberships m
   SET capabilities=array_append(m.capabilities,'RISK_MANAGE')
  FROM app.tenants t
 WHERE t.id=m.tenant_id AND t.is_demo=true
   AND NOT ('RISK_MANAGE'=ANY(m.capabilities));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.risk_policies TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_risk(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
