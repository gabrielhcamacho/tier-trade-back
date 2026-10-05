BEGIN;

CREATE INDEX bank_accounts_created_by
  ON app.bank_accounts (tenant_id,created_by);
CREATE INDEX finance_policies_created_by
  ON app.finance_policies (tenant_id,created_by);
CREATE INDEX financial_title_adjustments_reversed_by
  ON app.financial_title_adjustments (tenant_id,reversed_by)
  WHERE reversed_by IS NOT NULL;
CREATE INDEX payment_batches_executed_by
  ON app.payment_batches (tenant_id,executed_by)
  WHERE executed_by IS NOT NULL;

COMMIT;
