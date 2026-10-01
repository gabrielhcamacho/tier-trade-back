BEGIN;

CREATE INDEX access_invitations_invited_by
  ON control.access_invitations (tenant_id, invited_by);

COMMIT;
