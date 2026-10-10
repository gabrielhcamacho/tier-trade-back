BEGIN;

-- O peso aceito no destino e o ticket de descarga são fatos operacionais.
-- Tolerância, desconto e reflexo financeiro dependem de política comercial
-- versionada e, portanto, não são inferidos nesta tabela.
CREATE TABLE app.dispatch_destination_receipts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  dispatch_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  destination_weight_kg numeric(20,3) NOT NULL CHECK (destination_weight_kg > 0),
  unloaded_at timestamptz NOT NULL,
  terminal_code text NOT NULL CHECK (terminal_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  ticket_reference text NOT NULL CHECK (length(trim(ticket_reference)) BETWEEN 1 AND 80),
  destination_document_reference text CHECK (
    destination_document_reference IS NULL OR
    length(trim(destination_document_reference)) BETWEEN 1 AND 80
  ),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  notes text CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  is_current boolean NOT NULL DEFAULT true,
  supersedes_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,dispatch_id,version),
  FOREIGN KEY (tenant_id,dispatch_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  FOREIGN KEY (tenant_id,supersedes_id) REFERENCES app.dispatch_destination_receipts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE UNIQUE INDEX dispatch_destination_receipts_one_current
  ON app.dispatch_destination_receipts (tenant_id,dispatch_id) WHERE is_current=true;
CREATE INDEX dispatch_destination_receipts_history
  ON app.dispatch_destination_receipts (tenant_id,dispatch_id,version DESC);

ALTER TABLE app.dispatch_destination_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dispatch_destination_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.dispatch_destination_receipts
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE FUNCTION app.delete_demo_dispatch_destination_receipts(
  p_tenant_id uuid,
  p_actor_id uuid
)
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
  DELETE FROM app.dispatch_destination_receipts WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_dispatch_destination_receipts(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.dispatch_destination_receipts TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_dispatch_destination_receipts(uuid,uuid)
      TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
