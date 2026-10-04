import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { resetDemoTenant } from '../demo/demo-seed.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const headers = { 'x-tenant-id': tenantId, 'x-actor-id': actorId };

describe.runIf(Boolean(databaseUrl))('risk position', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    const setup = new Pool({ connectionString: databaseUrl });
    await setup.query('DROP SCHEMA IF EXISTS control CASCADE');
    await setup.query('DROP SCHEMA IF EXISTS app CASCADE');
    const migrations = [
      '20261001000100_commercial_foundation.sql', '20261001000200_outbox_read_models.sql',
      '20261001000300_commercial_governance.sql', '20261001193311_harden_tenant_rls.sql',
      '20261001194949_optimize_tenant_rls.sql', '20261001224302_control_plane_access.sql',
      '20261001224527_index_control_invitation_inviter.sql', '20261002030013_operations_load_scheduling.sql',
      '20261002031951_grant_operations_runtime.sql', '20261002042905_demo_tenant_contract_portfolio.sql',
      '20261002162513_operations_receiving_quality.sql', '20261002163915_grant_demo_reset_load_receipts.sql',
      '20261002174124_inventory_receipt_ledger.sql', '20261002211618_sales_fulfillment_slice.sql',
      '20261002220831_financial_receivables_slice.sql', '20261002224025_risk_position_slice.sql',
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
    ];
    for (const migration of migrations) {
      await setup.query(await readFile(new URL(`../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await setup.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await setup.query('UPDATE app.tenants SET is_demo=true WHERE id=$1', [tenantId]);
    await resetDemoTenant(setup, { tenantId, actorId });
    await setup.end();

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'development';
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false, abortOnError: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => app?.close());

  it('consolidates contracts, stock and finance without inventing market values', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET', url: '/v1/risk', headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      tenant: { isDemo: true, demoSeedVersion: 11 },
      positions: [{
        commodity: 'MILHO',
        physical: {
          purchaseContractedKg: '1950000.000', salesContractedKg: '20000.000',
          netContractualKg: '1930000.000', physicalStockKg: '24920.000',
          committedStockKg: '12000.000', availableStockKg: '12920.000',
          dispatchedKg: '8000.000', fulfillmentCoveragePct: '100.00',
        },
        financial: {
          purchaseCommitmentAmount: '2244250.00', salesCommitmentAmount: '28400.00',
          netContractedAmount: '-2215850.00', projectedReceivableAmount: '11360.00',
          outstandingReceivableAmount: '7360.00', receivedAmount: '4000.00',
        },
        limit: {
          version: 1, maxNetOpenKg: '2100000.000', warningThresholdPct: '80.00',
          usagePct: '91.90', status: 'WARNING',
        },
      }],
      marketRisk: { status: 'BLOCKED_CONFIGURATION' },
    });
  });

  it('versions the limit policy and immediately recalculates its status', async () => {
    const server = app.getHttpAdapter().getInstance();
    const update = await server.inject({
      method: 'PATCH', url: '/v1/risk/policy', headers,
      payload: { commodity: 'MILHO', maxNetOpenKg: '100000.000', warningThresholdPct: '75.00' },
    });
    expect(update.statusCode, update.body).toBe(200);
    expect(update.json()).toMatchObject({ version: 2, active: true, maxNetOpenKg: '100000.000' });

    const workspace = await server.inject({ method: 'GET', url: '/v1/risk', headers });
    expect(workspace.json().positions[0].limit).toMatchObject({
      version: 2, usagePct: '1930.00', status: 'EXCEEDED',
    });
  });
});
