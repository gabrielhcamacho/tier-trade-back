BEGIN;

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

CREATE TABLE app.tenants (
  id uuid PRIMARY KEY,
  legal_name text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.memberships (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  user_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  capabilities text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE app.counterparties (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  legal_name text NOT NULL,
  tax_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, tax_id)
);

CREATE TABLE app.margin_policies (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  commodity text NOT NULL CHECK (commodity IN ('MILHO')),
  version integer NOT NULL CHECK (version > 0),
  auto_approval_margin_per_sc numeric(20,6) NOT NULL,
  absolute_floor_margin_per_sc numeric(20,6) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, commodity, version),
  CHECK (auto_approval_margin_per_sc >= absolute_floor_margin_per_sc)
);
CREATE UNIQUE INDEX margin_policy_one_active
  ON app.margin_policies (tenant_id, commodity) WHERE active;

CREATE TABLE app.offers (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  commodity text NOT NULL CHECK (commodity IN ('MILHO')),
  unit text NOT NULL CHECK (unit IN ('SC_60KG')),
  quantity_sc numeric(20,6) NOT NULL CHECK (quantity_sc > 0),
  delivery_start date NOT NULL,
  delivery_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','IN_APPROVAL','APPROVED','CONVERTED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, counterparty_id) REFERENCES app.counterparties(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES app.memberships(tenant_id, user_id),
  CHECK (delivery_end >= delivery_start)
);

CREATE TABLE app.pricing_scenarios (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  offer_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  policy_version integer NOT NULL,
  purchase_price_per_sc numeric(20,6) NOT NULL,
  sale_reference_per_sc numeric(20,6) NOT NULL,
  total_costs_per_sc numeric(20,6) NOT NULL,
  projected_margin_per_sc numeric(20,6) NOT NULL,
  cost_breakdown jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, offer_id),
  FOREIGN KEY (tenant_id, offer_id) REFERENCES app.offers(tenant_id, id),
  FOREIGN KEY (tenant_id, policy_id) REFERENCES app.margin_policies(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES app.memberships(tenant_id, user_id)
);

CREATE TABLE app.approvals (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  offer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  requested_by uuid NOT NULL,
  decided_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, offer_id) REFERENCES app.offers(tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES app.memberships(tenant_id, user_id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES app.memberships(tenant_id, user_id)
);

CREATE TABLE app.contracts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  offer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','CANCELLED')),
  created_by uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, offer_id),
  FOREIGN KEY (tenant_id, offer_id) REFERENCES app.offers(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES app.memberships(tenant_id, user_id)
);

CREATE TABLE app.contract_obligations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  contract_id uuid NOT NULL,
  code text NOT NULL CHECK (code IN ('SIGNED_CONTRACT','DELIVERY_SCHEDULE')),
  status text NOT NULL CHECK (status IN ('PENDING','COMPLETED')),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, contract_id, code),
  FOREIGN KEY (tenant_id, contract_id) REFERENCES app.contracts(tenant_id, id)
);

CREATE TABLE app.audit_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_id uuid NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_id) REFERENCES app.memberships(tenant_id, user_id)
);

CREATE TABLE app.outbox_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX outbox_unpublished ON app.outbox_events (occurred_at) WHERE published_at IS NULL;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['memberships','counterparties','margin_policies','offers',
    'pricing_scenarios','approvals','contracts','contract_obligations','audit_events','outbox_events']
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
