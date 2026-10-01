BEGIN;

CREATE SCHEMA IF NOT EXISTS control;
REVOKE ALL ON SCHEMA control FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA control FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA control FROM authenticated;
  END IF;
END $$;

CREATE TABLE control.membership_directory (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  user_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE UNIQUE INDEX membership_directory_one_active_tenant_per_user
  ON control.membership_directory (user_id) WHERE active;

CREATE TABLE control.access_invitations (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(trim(email))),
  invited_user_id uuid,
  capabilities text[] NOT NULL CHECK (cardinality(capabilities) > 0),
  status text NOT NULL CHECK (status IN ('PENDING','SENT','ACCEPTED','EXPIRED','FAILED','REVOKED')),
  invited_by uuid NOT NULL,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  FOREIGN KEY (tenant_id, invited_by) REFERENCES app.memberships(tenant_id, user_id),
  CHECK ((status = 'ACCEPTED') = (accepted_at IS NOT NULL)),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX access_invitations_one_open_per_email
  ON control.access_invitations (tenant_id, lower(email))
  WHERE status IN ('PENDING','SENT');
CREATE INDEX access_invitations_user
  ON control.access_invitations (invited_user_id) WHERE invited_user_id IS NOT NULL;

CREATE FUNCTION control.sync_membership_directory() RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, control
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM control.membership_directory
      WHERE tenant_id = OLD.tenant_id AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  INSERT INTO control.membership_directory (tenant_id,user_id,active)
  VALUES (NEW.tenant_id,NEW.user_id,NEW.active)
  ON CONFLICT (tenant_id,user_id) DO UPDATE
    SET active=excluded.active,updated_at=now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION control.sync_membership_directory() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION control.sync_membership_directory() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION control.sync_membership_directory() FROM authenticated;
  END IF;
END $$;

CREATE TRIGGER memberships_sync_control_directory
AFTER INSERT OR UPDATE OF active,tenant_id,user_id OR DELETE ON app.memberships
FOR EACH ROW EXECUTE FUNCTION control.sync_membership_directory();

INSERT INTO control.membership_directory (tenant_id,user_id,active)
SELECT tenant_id,user_id,active FROM app.memberships
ON CONFLICT (tenant_id,user_id) DO UPDATE
  SET active=excluded.active,updated_at=now();

UPDATE app.memberships
SET capabilities = array_append(capabilities, 'ACCESS_MANAGE')
WHERE active
  AND 'MARGIN_POLICY_MANAGE' = ANY(capabilities)
  AND NOT ('ACCESS_MANAGE' = ANY(capabilities));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT USAGE ON SCHEMA control TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON control.membership_directory,control.access_invitations
      TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
