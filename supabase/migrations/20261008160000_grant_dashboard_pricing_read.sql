BEGIN;

-- Dashboard snapshots read the current pricing scenario of each offer to
-- report projected margin and price composition. Read-only access.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT ON app.pricing_scenarios TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
