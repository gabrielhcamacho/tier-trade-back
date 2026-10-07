-- Preliminary commercial demand. Indicative prices never enter pricing scenarios or official balances.
CREATE TABLE app.commercial_demands (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('PURCHASE','SALE')),
  commodity text NOT NULL CHECK (commodity IN ('MILHO','SOJA')),
  unit text NOT NULL DEFAULT 'SC_60KG' CHECK (unit = 'SC_60KG'),
  quantity_sc numeric(20,6) NOT NULL CHECK (quantity_sc > 0),
  delivery_start date NOT NULL,
  delivery_end date NOT NULL,
  indicative_price_per_sc numeric(20,6) CHECK (indicative_price_per_sc >= 0),
  description text CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  close_reason text CHECK (close_reason IS NULL OR char_length(btrim(close_reason)) BETWEEN 3 AND 500),
  created_by uuid NOT NULL,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,counterparty_id) REFERENCES app.counterparties(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,closed_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (delivery_end >= delivery_start),
  CHECK ((status='OPEN' AND closed_by IS NULL AND closed_at IS NULL AND close_reason IS NULL)
      OR (status='CLOSED' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND close_reason IS NOT NULL))
);
CREATE INDEX commercial_demands_counterparty_idx ON app.commercial_demands (tenant_id,counterparty_id);
CREATE INDEX commercial_demands_open_idx ON app.commercial_demands (tenant_id,created_at DESC,id DESC)
  WHERE status='OPEN';

CREATE TABLE app.commercial_negotiation_entries (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  demand_id uuid NOT NULL,
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 3 AND 1000),
  indicative_price_per_sc numeric(20,6) CHECK (indicative_price_per_sc >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES app.commercial_demands(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);
CREATE INDEX commercial_negotiation_entries_demand_idx
  ON app.commercial_negotiation_entries (tenant_id,demand_id,created_at DESC,id DESC);
CREATE INDEX commercial_negotiation_entries_created_by_idx
  ON app.commercial_negotiation_entries (tenant_id,created_by);

DO $$ DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['commercial_demands','commercial_negotiation_entries'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',relation_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',relation_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = nullif((SELECT current_setting(''app.tenant_id'',true)),'''')::uuid) WITH CHECK (tenant_id = nullif((SELECT current_setting(''app.tenant_id'',true)),'''')::uuid)',
      relation_name);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.commercial_demands TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.commercial_negotiation_entries TO tier_trade_runtime;
  END IF;
END $$;
