import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import type { DatabasePlatformPort } from './database.js';
import { DASHBOARD_MODULES } from '../dashboard/dashboard.constants.js';
import { DashboardProcessor } from '../dashboard/dashboard.processor.js';
import { DashboardRefreshService } from '../dashboard/dashboard-refresh.service.js';
import { DashboardSnapshotBuilder } from '../dashboard/dashboard-snapshot.builder.js';

describe('commercial foundation migration', () => {
  it('applies and isolates rows through the transaction tenant context', async () => {
    const db = new PGlite();
    await db.exec('CREATE ROLE tier_trade_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    for (const migrationName of [
      '20261001000100_commercial_foundation.sql',
      '20261001000200_outbox_read_models.sql',
      '20261001000300_commercial_governance.sql',
      '20261001193311_harden_tenant_rls.sql',
      '20261001194949_optimize_tenant_rls.sql',
      '20261001224302_control_plane_access.sql',
      '20261001224527_index_control_invitation_inviter.sql',
      '20261002030013_operations_load_scheduling.sql',
      '20261002031951_grant_operations_runtime.sql',
      '20261002042905_demo_tenant_contract_portfolio.sql',
      '20261002162513_operations_receiving_quality.sql',
      '20261002163915_grant_demo_reset_load_receipts.sql',
      '20261002174124_inventory_receipt_ledger.sql',
      '20261002211618_sales_fulfillment_slice.sql',
      '20261002220831_financial_receivables_slice.sql',
      '20261002224025_risk_position_slice.sql',
      '20261002224945_cover_operational_foreign_keys.sql',
      '20261002234414_fiscal_document_registry.sql',
      '20261003000202_cover_fiscal_source_foreign_key.sql',
      '20261003003904_fiscal_configuration_catalog.sql',
      '20261003011929_fiscal_calculation_engine.sql',
      '20261003014022_fiscal_obligations_and_financial_effects.sql',
      '20261003194521_fiscal_payments_and_cash_flow.sql',
      '20261004155718_phase1_commodity_and_counterparty_profile.sql',
      '20261004164744_sales_contract_versions.sql',
      '20261004221411_operations_receipt_document_weights.sql',
      '20261004224629_cover_sales_contract_version_recorder_fk.sql',
      '20261004234000_operations_yard_occurrences_romaneio.sql',
      '20261005002533_purchase_fiscal_payables.sql',
      '20261005003926_cover_purchase_operation_foreign_keys.sql',
      '20261005004718_preserve_outbound_fiscal_source_integrity.sql',
      '20261005010100_grant_purchase_finance_runtime.sql',
      '20261005021155_finance_governance_and_realized_margin.sql',
      '20261005023251_cover_finance_governance_foreign_keys.sql',
      '20261005160713_operational_completeness_foundation.sql',
      '20261005160901_cover_operational_completeness_foreign_keys.sql',
      '20261005161634_demo_reset_operational_completeness.sql',
      '20261005213800_contract_obligation_workflow.sql',
      '20261007205930_purchase_contract_terms.sql',
      '20261007213335_contract_obligation_evidence.sql',
      '20261007214032_commercial_demands_negotiations.sql',
      '20261007214736_cover_commercial_actor_foreign_keys_and_terms_rls.sql',
      '20261007222434_contract_lifecycle_and_version_references.sql',
      '20261007224325_cover_document_contract_version_foreign_keys.sql',
      '20261008011332_bank_statement_import_batches.sql',
      '20261008032009_dashboard_read_model_foundation.sql',
      '20261008032742_optimize_dashboard_rls_initplan.sql',
      '20261008032945_optimize_dashboard_rls_function_initplan.sql',
      '20261008034318_index_active_dashboard_tenants.sql',
      '20261008160000_grant_dashboard_pricing_read.sql',
    ]) {
      const migration = await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
      await db.exec(migration);
    }
    await db.exec(`
      INSERT INTO app.tenants (id,legal_name,timezone) VALUES
        ('11111111-1111-4111-8111-111111111111','A','America/Sao_Paulo'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','B','America/Sao_Paulo');
      INSERT INTO app.memberships (tenant_id,user_id,capabilities) VALUES
        ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',ARRAY['COMMERCIAL_EDIT']),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd',ARRAY['FINANCE_EDIT']);
      INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id) VALUES
        ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','A supplier','1'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B supplier','2');
      INSERT INTO app.commercial_activity_read_model
        (tenant_id,event_id,event_type,aggregate_type,aggregate_id,payload,occurred_at) VALUES
        ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','offer.created','offer','33333333-3333-4333-8333-333333333333','{}',now()),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','offer.created','offer','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',now());
      INSERT INTO app.bank_accounts (tenant_id,id,code,name,created_by) VALUES
        ('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','A001','Conta tenant A','22222222-2222-4222-8222-222222222222'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff','B001','Conta tenant B','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
      INSERT INTO app.dashboard_snapshots
        (tenant_id,module,scope_key,contract_version,snapshot_version,payload) VALUES
        ('11111111-1111-4111-8111-111111111111','central','default',1,1,'{"tenant":"A"}'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','central','default',1,1,'{"tenant":"B"}');
      INSERT INTO app.dashboard_refresh_queue (tenant_id,module,scope_key) VALUES
        ('11111111-1111-4111-8111-111111111111','central','default'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','central','default');
      CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA app TO app_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO app_runtime;
      GRANT USAGE ON SCHEMA control TO app_runtime;
      GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA control TO app_runtime;
      SET ROLE app_runtime;
      SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false);
    `);
    const result = await db.query<{ legal_name: string }>('SELECT legal_name FROM app.counterparties ORDER BY legal_name');
    expect(result.rows).toEqual([{ legal_name: 'A supplier' }]);
    const activity = await db.query<{ event_id: string }>('SELECT event_id FROM app.commercial_activity_read_model');
    expect(activity.rows).toEqual([{ event_id: '44444444-4444-4444-8444-444444444444' }]);
    await db.exec('RESET ROLE');
    const directory = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM control.membership_directory
        WHERE user_id='22222222-2222-4222-8222-222222222222' AND active=true`,
    );
    expect(directory.rows).toEqual([{ tenant_id: '11111111-1111-4111-8111-111111111111' }]);
    const readModels = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='app' AND table_name LIKE '%read_model' ORDER BY table_name`,
    );
    expect(readModels.rows).toEqual([
      { table_name: 'commercial_activity_read_model' },
      { table_name: 'contract_summary_read_model' },
    ]);
    await db.exec("SET ROLE tier_trade_runtime; SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false)");
    const visibleLoads = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.loads');
    expect(visibleLoads.rows).toEqual([{ count: 0 }]);
    const visibleReceipts = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.load_receipts');
    expect(visibleReceipts.rows).toEqual([{ count: 0 }]);
    const visibleLots = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.inventory_lots');
    expect(visibleLots.rows).toEqual([{ count: 0 }]);
    const visibleMovements = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.inventory_movements');
    expect(visibleMovements.rows).toEqual([{ count: 0 }]);
    const visibleRiskPolicies = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.risk_policies');
    expect(visibleRiskPolicies.rows).toEqual([{ count: 0 }]);
    const visibleFiscalDocuments = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_documents');
    expect(visibleFiscalDocuments.rows).toEqual([{ count: 0 }]);
    const visibleFiscalEstablishments = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_establishments');
    expect(visibleFiscalEstablishments.rows).toEqual([{ count: 0 }]);
    const visibleFiscalConfigurations = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_configuration_versions');
    expect(visibleFiscalConfigurations.rows).toEqual([{ count: 0 }]);
    const visibleFiscalCalculations = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_calculations');
    expect(visibleFiscalCalculations.rows).toEqual([{ count: 0 }]);
    const visibleFiscalAuthorities = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_authorities');
    expect(visibleFiscalAuthorities.rows).toEqual([{ count: 0 }]);
    const visibleFiscalObligations = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.fiscal_obligations');
    expect(visibleFiscalObligations.rows).toEqual([{ count: 0 }]);
    const visibleFinancialAdjustments = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.financial_title_adjustments');
    expect(visibleFinancialAdjustments.rows).toEqual([{ count: 0 }]);
    const visibleFinancialPayments = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.financial_payments');
    expect(visibleFinancialPayments.rows).toEqual([{ count: 0 }]);
    const visibleBankAccounts = await db.query<{ code: string }>('SELECT code FROM app.bank_accounts ORDER BY code');
    expect(visibleBankAccounts.rows).toEqual([{ code: 'A001' }]);
    for (const table of [
      'purchase_cost_components', 'finance_policies', 'payment_batches', 'payment_batch_items',
      'bank_statement_entries',
    ]) {
      const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM app.${table}`);
      expect(result.rows).toEqual([{ count: 0 }]);
    }
    const visibleSalesVersions = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.sales_contract_versions');
    expect(visibleSalesVersions.rows).toEqual([{ count: 0 }]);
    const visiblePurchaseTerms = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM app.purchase_contract_terms',
    );
    expect(visiblePurchaseTerms.rows).toEqual([{ count: 0 }]);
    const visibleDashboardSnapshots = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM app.dashboard_snapshots',
    );
    expect(visibleDashboardSnapshots.rows).toEqual([{ count: 1 }]);
    const visibleDashboardRefreshes = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM app.dashboard_refresh_queue',
    );
    expect(visibleDashboardRefreshes.rows).toEqual([{ count: 1 }]);
    const builder = new DashboardSnapshotBuilder();
    for (const module of DASHBOARD_MODULES) {
      const payload = await builder.build(db as unknown as PoolClient,
        '11111111-1111-4111-8111-111111111111', module);
      expect(payload).toMatchObject({ contractVersion: 1, module, calendar: { timezone: 'America/Sao_Paulo' } });
      expect(Object.keys(payload.breakdowns as object).length).toBeGreaterThan(0);
    }
    const database = {
      transaction: async <T>(_tenantId: string, operation: (client: PoolClient) => Promise<T>) =>
        operation(db as unknown as PoolClient),
      controlPlaneTransaction: async <T>(operation: (client: PoolClient) => Promise<T>) =>
        operation(db as unknown as PoolClient),
    } as unknown as DatabasePlatformPort;
    const refresh = new DashboardRefreshService(database);
    expect(await refresh.ensureMissingSnapshots('11111111-1111-4111-8111-111111111111')).toBe(7);
    const batch = await new DashboardProcessor(database, builder)
      .processTenant('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 8);
    expect(batch).toMatchObject({ claimed: 8, built: 8, failed: 0, pending: 0 });
    const builtSnapshots = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM app.dashboard_snapshots',
    );
    expect(builtSnapshots.rows).toEqual([{ count: 8 }]);
    await db.exec('RESET ROLE');
    const runtimePrivileges = await db.query<{ can_update: boolean }>(
      "SELECT has_table_privilege('tier_trade_runtime','app.financial_events','UPDATE') AS can_update",
    );
    expect(runtimePrivileges.rows).toEqual([{ can_update: true }]);
    const dashboardPrivileges = await db.query<{ can_read: boolean; can_write: boolean }>(
      `SELECT has_table_privilege('tier_trade_runtime','app.dashboard_snapshots','SELECT') AS can_read,
              has_table_privilege('tier_trade_runtime','app.dashboard_refresh_queue','UPDATE') AS can_write`,
    );
    expect(dashboardPrivileges.rows).toEqual([{ can_read: true, can_write: true }]);
    await db.close();
  }, 15_000);
});
