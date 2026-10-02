BEGIN;

ALTER TABLE app.tenants
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN demo_seed_version integer,
  ADD CONSTRAINT tenants_demo_seed_version_positive
    CHECK (demo_seed_version IS NULL OR demo_seed_version > 0),
  ADD CONSTRAINT tenants_demo_seed_only_for_demo
    CHECK (is_demo OR demo_seed_version IS NULL);

COMMENT ON COLUMN app.tenants.is_demo IS
  'Identifies a tenant whose persisted data is safe for product demonstrations.';
COMMENT ON COLUMN app.tenants.demo_seed_version IS
  'Canonical demo dataset version most recently provisioned for this tenant.';

COMMIT;
