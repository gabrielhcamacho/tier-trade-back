BEGIN;

CREATE TABLE app.load_receipts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  load_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  is_current boolean NOT NULL DEFAULT true,
  received_at timestamptz NOT NULL,
  gross_weight_kg numeric(20,3) NOT NULL CHECK (gross_weight_kg > 0),
  tare_weight_kg numeric(20,3) NOT NULL CHECK (tare_weight_kg > 0),
  net_weight_kg numeric(20,3) GENERATED ALWAYS AS (gross_weight_kg - tare_weight_kg) STORED,
  weighing_mode text NOT NULL CHECK (weighing_mode IN ('SCALE','MANUAL_CONTINGENCY')),
  scale_ticket_number text,
  contingency_reason text,
  moisture_pct numeric(7,4) NOT NULL CHECK (moisture_pct BETWEEN 0 AND 100),
  impurity_pct numeric(7,4) NOT NULL CHECK (impurity_pct BETWEEN 0 AND 100),
  damaged_pct numeric(7,4) NOT NULL CHECK (damaged_pct BETWEEN 0 AND 100),
  quality_decision text NOT NULL CHECK (quality_decision IN ('ACCEPTED','REVIEW_REQUIRED')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,load_id,version),
  FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (gross_weight_kg > tare_weight_kg),
  CHECK (
    (weighing_mode = 'SCALE' AND scale_ticket_number IS NOT NULL
      AND length(trim(scale_ticket_number)) BETWEEN 1 AND 80
      AND contingency_reason IS NULL)
    OR
    (weighing_mode = 'MANUAL_CONTINGENCY' AND contingency_reason IS NOT NULL
      AND length(trim(contingency_reason)) BETWEEN 10 AND 500)
  ),
  CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000)
);

CREATE UNIQUE INDEX load_receipts_one_current
  ON app.load_receipts (tenant_id,load_id)
  WHERE is_current;
CREATE INDEX load_receipts_history
  ON app.load_receipts (tenant_id,load_id,version DESC);
CREATE INDEX load_receipts_created_by
  ON app.load_receipts (tenant_id,created_by);

ALTER TABLE app.load_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.load_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.load_receipts
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.load_receipts TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
