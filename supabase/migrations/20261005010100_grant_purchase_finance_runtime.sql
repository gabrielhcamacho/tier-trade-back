BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.financial_events TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
