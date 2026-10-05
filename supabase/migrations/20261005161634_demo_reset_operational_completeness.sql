BEGIN;

CREATE OR REPLACE FUNCTION app.delete_demo_operational_completeness(
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
       AND 'FINANCE_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;

  DELETE FROM app.document_signatures WHERE tenant_id=p_tenant_id;
  DELETE FROM app.documents WHERE tenant_id=p_tenant_id;
  DELETE FROM app.commission_accruals WHERE tenant_id=p_tenant_id;
  DELETE FROM app.commission_policies WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_counts WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_transfers WHERE tenant_id=p_tenant_id;
  DELETE FROM app.inventory_movements
    WHERE tenant_id=p_tenant_id AND movement_type IN ('LOSS','COUNT_ADJUSTMENT');
  DELETE FROM app.inventory_lot_events WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_operational_completeness(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT EXECUTE ON FUNCTION app.delete_demo_operational_completeness(uuid,uuid)
      TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
