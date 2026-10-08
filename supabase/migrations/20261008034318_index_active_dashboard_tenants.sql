BEGIN;

CREATE INDEX membership_directory_active_tenants
  ON control.membership_directory (tenant_id)
  WHERE active;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT ON
      app.offers,app.contracts,app.contract_obligations,app.contract_amendments,
      app.commercial_demands,app.commercial_negotiation_entries,app.counterparties,
      app.loads,app.load_receipts,app.load_occurrences,
      app.inventory_locations,app.inventory_lots,app.inventory_movements,app.inventory_transfers,
      app.sales_contracts,app.risk_policies,
      app.financial_events,app.financial_titles,app.financial_settlements,app.financial_payments,
      app.financial_title_adjustments,app.payment_batches,app.bank_statement_entries,
      app.fiscal_documents,app.fiscal_configuration_versions,app.fiscal_calculations,
      app.fiscal_obligations,app.documents
    TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
