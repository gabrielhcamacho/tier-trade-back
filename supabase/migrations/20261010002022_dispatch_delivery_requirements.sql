BEGIN;

CREATE TABLE app.delivery_requirement_policies (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  terminal_code text NOT NULL CHECK (terminal_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  requirement_type text NOT NULL CHECK (requirement_type IN ('DESTINATION_TICKET','PORTAL_CONFIRMATION')),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  responsible_name text NOT NULL CHECK (length(trim(responsible_name)) BETWEEN 2 AND 120),
  due_hours_after_dispatch integer NOT NULL CHECK (due_hours_after_dispatch BETWEEN 0 AND 720),
  portal_name text CHECK (portal_name IS NULL OR length(trim(portal_name)) BETWEEN 2 AND 120),
  portal_url text CHECK (portal_url IS NULL OR length(trim(portal_url)) BETWEEN 8 AND 500),
  consequence text NOT NULL CHECK (consequence IN ('INFORMATIONAL','BLOCK_OPERATIONAL_CLOSURE','BLOCK_ANTICIPATION')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,counterparty_id,terminal_code,requirement_type,version),
  FOREIGN KEY (tenant_id,counterparty_id) REFERENCES app.counterparties(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE UNIQUE INDEX delivery_requirement_policies_one_active
  ON app.delivery_requirement_policies (tenant_id,counterparty_id,terminal_code,requirement_type)
  WHERE active=true;
CREATE INDEX delivery_requirement_policies_lookup
  ON app.delivery_requirement_policies (tenant_id,counterparty_id,terminal_code)
  WHERE active=true;

CREATE TABLE app.dispatch_delivery_requirements (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  dispatch_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  policy_version integer NOT NULL,
  requirement_type text NOT NULL CHECK (requirement_type IN ('DESTINATION_TICKET','PORTAL_CONFIRMATION')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  responsible_name text NOT NULL CHECK (length(trim(responsible_name)) BETWEEN 2 AND 120),
  due_at timestamptz NOT NULL,
  portal_name text,
  portal_url text,
  consequence text NOT NULL CHECK (consequence IN ('INFORMATIONAL','BLOCK_OPERATIONAL_CLOSURE','BLOCK_ANTICIPATION')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUBMITTED','ACCEPTED','REJECTED','WAIVED')),
  evidence_reference text CHECK (evidence_reference IS NULL OR length(trim(evidence_reference)) BETWEEN 1 AND 160),
  portal_confirmation text CHECK (portal_confirmation IS NULL OR length(trim(portal_confirmation)) BETWEEN 1 AND 160),
  notes text CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  resolution_reason text CHECK (resolution_reason IS NULL OR length(trim(resolution_reason)) BETWEEN 5 AND 1000),
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,dispatch_id,policy_id,policy_version),
  FOREIGN KEY (tenant_id,dispatch_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  FOREIGN KEY (tenant_id,policy_id) REFERENCES app.delivery_requirement_policies(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,updated_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK ((status IN ('ACCEPTED','REJECTED','WAIVED')) = (resolved_at IS NOT NULL)),
  CHECK (status <> 'SUBMITTED' OR submitted_at IS NOT NULL)
);

CREATE INDEX dispatch_delivery_requirements_queue
  ON app.dispatch_delivery_requirements (tenant_id,status,due_at,dispatch_id);

ALTER TABLE app.delivery_requirement_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delivery_requirement_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.delivery_requirement_policies
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.dispatch_delivery_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dispatch_delivery_requirements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.dispatch_delivery_requirements
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE FUNCTION app.delete_demo_delivery_requirements(p_tenant_id uuid,p_actor_id uuid)
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
  DELETE FROM app.dispatch_delivery_requirements WHERE tenant_id=p_tenant_id;
  DELETE FROM app.delivery_requirement_policies WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_delivery_requirements(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.delivery_requirement_policies TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.dispatch_delivery_requirements TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_delivery_requirements(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
