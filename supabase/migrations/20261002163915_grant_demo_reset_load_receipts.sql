BEGIN;

CREATE OR REPLACE FUNCTION app.delete_demo_load_receipts(p_tenant_id uuid, p_actor_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id', true), '')::uuid THEN
    RAISE EXCEPTION 'DEMO_RESET_TENANT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.tenants t WHERE t.id=p_tenant_id AND t.is_demo=true
  ) THEN
    RAISE EXCEPTION 'TENANT_IS_NOT_MARKED_AS_DEMO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.memberships m
     WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_id AND m.active=true
       AND 'OPERATIONS_EDIT'=ANY(m.capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITIES_INCOMPLETE';
  END IF;

  DELETE FROM app.load_receipts WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_load_receipts(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT EXECUTE ON FUNCTION app.delete_demo_load_receipts(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
