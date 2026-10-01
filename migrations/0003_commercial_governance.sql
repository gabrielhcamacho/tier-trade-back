BEGIN;

ALTER TABLE app.offers DROP CONSTRAINT offers_status_check;
ALTER TABLE app.offers
  ADD CONSTRAINT offers_status_check
  CHECK (status IN ('DRAFT','IN_APPROVAL','APPROVED','CONVERTED','CANCELLED'));
ALTER TABLE app.offers
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancellation_reason text,
  ADD CONSTRAINT offers_cancelled_by_fkey
    FOREIGN KEY (tenant_id,cancelled_by) REFERENCES app.memberships(tenant_id,user_id),
  ADD CONSTRAINT offers_cancellation_consistency CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
      AND length(trim(cancellation_reason)) BETWEEN 3 AND 500)
    OR
    (status <> 'CANCELLED' AND cancelled_at IS NULL AND cancelled_by IS NULL
      AND cancellation_reason IS NULL)
  );
CREATE INDEX offers_cancelled_by
  ON app.offers (tenant_id,cancelled_by) WHERE cancelled_by IS NOT NULL;
CREATE INDEX offers_counterparty ON app.offers (tenant_id,counterparty_id);
CREATE INDEX offers_created_by ON app.offers (tenant_id,created_by);

ALTER TABLE app.approvals DROP CONSTRAINT approvals_status_check;
ALTER TABLE app.approvals
  ADD CONSTRAINT approvals_status_check CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED'));

ALTER TABLE app.pricing_scenarios
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN is_current boolean NOT NULL DEFAULT true;
ALTER TABLE app.pricing_scenarios DROP CONSTRAINT pricing_scenarios_tenant_id_offer_id_key;
ALTER TABLE app.pricing_scenarios
  ADD CONSTRAINT pricing_scenarios_offer_version_key UNIQUE (tenant_id,offer_id,version);
CREATE UNIQUE INDEX pricing_scenarios_one_current
  ON app.pricing_scenarios (tenant_id,offer_id) WHERE is_current;
CREATE INDEX pricing_scenarios_policy ON app.pricing_scenarios (tenant_id,policy_id);
CREATE INDEX pricing_scenarios_created_by ON app.pricing_scenarios (tenant_id,created_by);
CREATE INDEX approvals_offer ON app.approvals (tenant_id,offer_id);
CREATE INDEX approvals_requested_by ON app.approvals (tenant_id,requested_by);
CREATE INDEX approvals_decided_by
  ON app.approvals (tenant_id,decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX contracts_created_by ON app.contracts (tenant_id,created_by);
CREATE INDEX audit_events_actor ON app.audit_events (tenant_id,actor_id);

COMMIT;
