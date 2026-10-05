BEGIN;

ALTER TABLE app.fiscal_configuration_versions
  DROP CONSTRAINT fiscal_configuration_versions_operation_type_check,
  ADD CONSTRAINT fiscal_configuration_versions_operation_type_check
    CHECK (operation_type IN ('SALE_DISPATCH','PURCHASE_RECEIPT'));

ALTER TABLE app.fiscal_calculations
  DROP CONSTRAINT fiscal_calculations_operation_type_check,
  ADD CONSTRAINT fiscal_calculations_operation_type_check
    CHECK (operation_type IN ('SALE_DISPATCH','PURCHASE_RECEIPT'));

CREATE TABLE app.purchase_cost_components (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  financial_event_id uuid NOT NULL,
  title_id uuid NOT NULL,
  load_receipt_id uuid NOT NULL,
  component_type text NOT NULL
    CHECK (component_type IN ('QUALITY_DISCOUNT','FREIGHT','STORAGE','TAX_WITHHOLDING','OTHER')),
  payable_impact text NOT NULL
    CHECK (payable_impact IN ('REDUCE_PAYABLE','INCREASE_PAYABLE','MEMO_ONLY')),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 500),
  external_reference text CHECK (external_reference IS NULL OR length(trim(external_reference)) BETWEEN 1 AND 80),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text CHECK (reversal_reason IS NULL OR length(trim(reversal_reason)) BETWEEN 3 AND 500),
  PRIMARY KEY (tenant_id,id),
  UNIQUE NULLS NOT DISTINCT (tenant_id,financial_event_id,component_type,external_reference),
  FOREIGN KEY (tenant_id,financial_event_id) REFERENCES app.financial_events(tenant_id,id),
  FOREIGN KEY (tenant_id,title_id) REFERENCES app.financial_titles(tenant_id,id),
  FOREIGN KEY (tenant_id,load_receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,reversed_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL)
  )
);

DO $$
DECLARE existing_unique name;
BEGIN
  SELECT conname INTO existing_unique
    FROM pg_constraint
   WHERE conrelid='app.financial_title_adjustments'::regclass
     AND contype='u' AND pg_get_constraintdef(oid) LIKE '%fiscal_obligation_id%'
   LIMIT 1;
  IF existing_unique IS NOT NULL THEN
    EXECUTE format('ALTER TABLE app.financial_title_adjustments DROP CONSTRAINT %I',existing_unique);
  END IF;
END $$;

ALTER TABLE app.financial_title_adjustments
  ALTER COLUMN fiscal_obligation_id DROP NOT NULL,
  DROP CONSTRAINT financial_title_adjustments_adjustment_type_check,
  ADD COLUMN purchase_cost_component_id uuid,
  ADD COLUMN adjustment_effect text NOT NULL DEFAULT 'REDUCE'
    CHECK (adjustment_effect IN ('REDUCE','INCREASE')),
  ADD COLUMN reversed_at timestamptz,
  ADD COLUMN reversed_by uuid,
  ADD COLUMN reversal_reason text CHECK (reversal_reason IS NULL OR length(trim(reversal_reason)) BETWEEN 3 AND 500),
  ADD CONSTRAINT financial_title_adjustments_adjustment_type_check
    CHECK (adjustment_type IN ('FISCAL_RETENTION','PURCHASE_COST_COMPONENT')),
  ADD CONSTRAINT financial_title_adjustments_purchase_component_fk
    FOREIGN KEY (tenant_id,purchase_cost_component_id)
    REFERENCES app.purchase_cost_components(tenant_id,id),
  ADD CONSTRAINT financial_title_adjustments_reversed_by_fk
    FOREIGN KEY (tenant_id,reversed_by) REFERENCES app.memberships(tenant_id,user_id),
  ADD CONSTRAINT financial_title_adjustments_source_shape CHECK (
    (adjustment_type='FISCAL_RETENTION' AND fiscal_obligation_id IS NOT NULL
      AND purchase_cost_component_id IS NULL AND adjustment_effect='REDUCE')
    OR
    (adjustment_type='PURCHASE_COST_COMPONENT' AND fiscal_obligation_id IS NULL
      AND purchase_cost_component_id IS NOT NULL)
  ),
  ADD CONSTRAINT financial_title_adjustments_reversal_shape CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL)
  );

CREATE UNIQUE INDEX financial_title_adjustments_fiscal_unique
  ON app.financial_title_adjustments (tenant_id,fiscal_obligation_id,adjustment_type)
  WHERE fiscal_obligation_id IS NOT NULL;
CREATE UNIQUE INDEX financial_title_adjustments_purchase_component_unique
  ON app.financial_title_adjustments (tenant_id,purchase_cost_component_id)
  WHERE purchase_cost_component_id IS NOT NULL;
CREATE INDEX purchase_cost_components_receipt
  ON app.purchase_cost_components (tenant_id,load_receipt_id,created_at,id);
CREATE INDEX purchase_cost_components_title
  ON app.purchase_cost_components (tenant_id,title_id,created_at,id);
CREATE INDEX purchase_cost_components_created_by
  ON app.purchase_cost_components (tenant_id,created_by);
CREATE INDEX purchase_cost_components_reversed_by
  ON app.purchase_cost_components (tenant_id,reversed_by) WHERE reversed_by IS NOT NULL;

CREATE TABLE app.finance_policies (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  payment_approval_threshold numeric(20,2) NOT NULL CHECK (payment_approval_threshold >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,version),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);
CREATE UNIQUE INDEX finance_policies_one_active
  ON app.finance_policies (tenant_id) WHERE active;

CREATE TABLE app.payment_batches (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  reference text NOT NULL CHECK (length(trim(reference)) BETWEEN 3 AND 40),
  scheduled_on date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','EXECUTED','CANCELLED')),
  total_amount numeric(20,2) NOT NULL CHECK (total_amount > 0),
  policy_version integer,
  approval_threshold numeric(20,2),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  executed_by uuid,
  executed_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,reference),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,approved_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,executed_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.payment_batch_items (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  batch_id uuid NOT NULL,
  title_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  payment_id uuid,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,batch_id,title_id),
  UNIQUE NULLS NOT DISTINCT (tenant_id,payment_id),
  FOREIGN KEY (tenant_id,batch_id) REFERENCES app.payment_batches(tenant_id,id),
  FOREIGN KEY (tenant_id,title_id) REFERENCES app.financial_titles(tenant_id,id),
  FOREIGN KEY (tenant_id,payment_id) REFERENCES app.financial_payments(tenant_id,id)
);

CREATE TABLE app.bank_accounts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.bank_statement_entries (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  direction text NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  bank_reference text NOT NULL CHECK (length(trim(bank_reference)) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR length(trim(description)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'UNMATCHED' CHECK (status IN ('UNMATCHED','MATCHED')),
  matched_type text CHECK (matched_type IS NULL OR matched_type IN ('SETTLEMENT','PAYMENT')),
  matched_id uuid,
  matched_by uuid,
  matched_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,bank_account_id,bank_reference),
  FOREIGN KEY (tenant_id,bank_account_id) REFERENCES app.bank_accounts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,matched_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (status='UNMATCHED' AND matched_type IS NULL AND matched_id IS NULL AND matched_by IS NULL AND matched_at IS NULL)
    OR
    (status='MATCHED' AND matched_type IS NOT NULL AND matched_id IS NOT NULL
      AND matched_by IS NOT NULL AND matched_at IS NOT NULL)
  )
);

ALTER TABLE app.financial_settlements ADD COLUMN bank_statement_entry_id uuid;
ALTER TABLE app.financial_settlements ADD CONSTRAINT financial_settlements_statement_fk
  FOREIGN KEY (tenant_id,bank_statement_entry_id) REFERENCES app.bank_statement_entries(tenant_id,id);
CREATE UNIQUE INDEX financial_settlements_statement_unique
  ON app.financial_settlements (tenant_id,bank_statement_entry_id)
  WHERE bank_statement_entry_id IS NOT NULL;

ALTER TABLE app.financial_payments ADD COLUMN bank_statement_entry_id uuid;
ALTER TABLE app.financial_payments ADD CONSTRAINT financial_payments_statement_fk
  FOREIGN KEY (tenant_id,bank_statement_entry_id) REFERENCES app.bank_statement_entries(tenant_id,id);
CREATE UNIQUE INDEX financial_payments_statement_unique
  ON app.financial_payments (tenant_id,bank_statement_entry_id)
  WHERE bank_statement_entry_id IS NOT NULL;

CREATE INDEX payment_batches_status_schedule
  ON app.payment_batches (tenant_id,status,scheduled_on,id);
CREATE INDEX payment_batches_created_by ON app.payment_batches (tenant_id,created_by);
CREATE INDEX payment_batches_approved_by ON app.payment_batches (tenant_id,approved_by)
  WHERE approved_by IS NOT NULL;
CREATE INDEX payment_batch_items_title ON app.payment_batch_items (tenant_id,title_id);
CREATE INDEX bank_statement_entries_status_time
  ON app.bank_statement_entries (tenant_id,status,occurred_at,id);
CREATE INDEX bank_statement_entries_created_by ON app.bank_statement_entries (tenant_id,created_by);
CREATE INDEX bank_statement_entries_matched_by ON app.bank_statement_entries (tenant_id,matched_by)
  WHERE matched_by IS NOT NULL;

ALTER TABLE app.purchase_cost_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.purchase_cost_components FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.purchase_cost_components
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);
ALTER TABLE app.finance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.finance_policies
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);
ALTER TABLE app.payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payment_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.payment_batches
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);
ALTER TABLE app.payment_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payment_batch_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.payment_batch_items
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);
ALTER TABLE app.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.bank_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.bank_accounts
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);
ALTER TABLE app.bank_statement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.bank_statement_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.bank_statement_entries
  USING (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id=nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

UPDATE app.memberships m
   SET capabilities=array_append(m.capabilities,'FINANCE_APPROVE')
  FROM app.tenants t
 WHERE t.id=m.tenant_id AND t.is_demo=true
   AND NOT ('FINANCE_APPROVE'=ANY(m.capabilities));

CREATE OR REPLACE FUNCTION app.delete_demo_finance(p_tenant_id uuid,p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,app
AS $$
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION 'TENANT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND is_demo=true) THEN
    RAISE EXCEPTION 'TENANT_IS_NOT_MARKED_AS_DEMO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.memberships
     WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND active=true
       AND 'FINANCE_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  DELETE FROM app.payment_batch_items WHERE tenant_id=p_tenant_id;
  DELETE FROM app.payment_batches WHERE tenant_id=p_tenant_id;
  DELETE FROM app.finance_policies WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_payments WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_settlements WHERE tenant_id=p_tenant_id;
  DELETE FROM app.bank_statement_entries WHERE tenant_id=p_tenant_id;
  DELETE FROM app.bank_accounts WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_title_adjustments WHERE tenant_id=p_tenant_id;
  DELETE FROM app.purchase_cost_components WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_titles WHERE tenant_id=p_tenant_id;
  DELETE FROM app.financial_events WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_finance(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.purchase_cost_components TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.financial_title_adjustments TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.finance_policies TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.payment_batches TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.payment_batch_items TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.bank_accounts TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.bank_statement_entries TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_finance(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
