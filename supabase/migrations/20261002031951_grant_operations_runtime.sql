BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT USAGE ON SCHEMA app TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON app.loads TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
