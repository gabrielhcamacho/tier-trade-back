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

describe.runIf(Boolean(databaseUrl))('financial receivables', () => {
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

  it('loads persisted forecasts, titles and receipts from the demo tenant', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET', url: '/v1/finance', headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      tenant: { isDemo: true, demoSeedVersion: 12 },
      summary: {
        projectedAmount: '11360.00', receivableAmount: '7360.00', receivedAmount: '4000.00',
        payableAmount: '0.00',
        pendingForecastCount: 0, pendingRoundingCount: 0,
      },
      events: [{
        contractReference: 'CV-2026-0042', calculatedAmount: '11360.00',
        title: { number: 'TR-2026-0001', status: 'PARTIALLY_SETTLED', outstandingAmount: '7360.00' },
      }],
      settlements: [{ bankReference: 'PIX-DEMO-0001', amount: '4000.00', reversedAt: null }],
    });
  });

  it('projects a dispatch, issues a title, records a partial receipt and preserves a reversal', async () => {
    const server = app.getHttpAdapter().getInstance();
    const inventory = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    const sale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', reference: 'CV-2026-0050',
        commodity: 'MILHO', quantityKg: '5000.000', salePricePerKg: '1.500000',
        destinationCode: 'IND_PR_01', deliveryStart: '2026-10-05', deliveryEnd: '2026-10-31',
        requiredDocuments: ['Nota fiscal'], paymentTermDays: 10,
      },
    });
    const allocation = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: inventory.json().lots[0].id, quantityKg: '5000.000' },
    });
    const dispatch = await server.inject({
      method: 'POST', url: '/v1/inventory/dispatches', headers,
      payload: {
        allocationId: allocation.json().id, quantityKg: '1000.000',
        dispatchedAt: '2026-10-02T10:00:00-03:00', vehiclePlate: 'MNO-4P56',
        documentReference: 'NF-TESTE-50', notes: null,
      },
    });
    expect(dispatch.statusCode, dispatch.body).toBe(201);
    expect(dispatch.json()).toMatchObject({ calculationStatus: 'READY' });

    const title = await server.inject({
      method: 'POST', url: '/v1/finance/titles', headers,
      payload: {
        financialEventId: dispatch.json().financialEventId, titleNumber: 'TR-2026-0050',
        documentReference: 'NFE-TESTE-50', dueDate: '2026-10-12',
      },
    });
    expect(title.statusCode, title.body).toBe(201);
    expect(title.json()).toMatchObject({ amount: '1500.00', status: 'OPEN' });

    const invalidPayment = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${title.json().id}/payments`, headers,
      payload: {
        amount: '100.00', paidAt: '2026-10-03T08:30:00-03:00',
        bankReference: 'PAGAMENTO-EM-RECEBIVEL', notes: null,
      },
    });
    expect(invalidPayment.statusCode).toBe(409);
    expect(invalidPayment.json()).toMatchObject({ code: 'RECEIVABLE_PAYMENT_FLOW_NOT_AVAILABLE' });

    const receipt = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${title.json().id}/settlements`, headers,
      payload: {
        amount: '500.00', receivedAt: '2026-10-03T09:00:00-03:00',
        bankReference: 'PIX-TESTE-50', notes: 'Recebimento parcial.',
      },
    });
    expect(receipt.statusCode, receipt.body).toBe(201);
    expect(receipt.json()).toMatchObject({ outstandingAmount: '1000.00', status: 'PARTIALLY_SETTLED' });

    const overflow = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${title.json().id}/settlements`, headers,
      payload: {
        amount: '1000.01', receivedAt: '2026-10-03T10:00:00-03:00',
        bankReference: 'PIX-TESTE-OVERFLOW', notes: null,
      },
    });
    expect(overflow.statusCode).toBe(422);
    expect(overflow.json()).toMatchObject({ code: 'SETTLEMENT_EXCEEDS_TITLE_BALANCE' });

    const reversal = await server.inject({
      method: 'POST', url: `/v1/finance/settlements/${receipt.json().id}/reverse`, headers,
      payload: { reason: 'Teste de estorno rastreável.' },
    });
    expect(reversal.statusCode, reversal.body).toBe(201);
    expect(reversal.json()).toMatchObject({ status: 'OPEN', reversed: true });
  });

  it('does not silently round a forecast without a configured policy', async () => {
    const server = app.getHttpAdapter().getInstance();
    const inventory = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    const sale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', reference: 'CV-2026-0051',
        commodity: 'MILHO', quantityKg: '10.000', salePricePerKg: '1.333333',
        destinationCode: 'IND_PR_02', deliveryStart: '2026-10-05', deliveryEnd: '2026-10-31',
        requiredDocuments: [], paymentTermDays: null,
      },
    });
    const allocation = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: inventory.json().lots[0].id, quantityKg: '10.000' },
    });
    const dispatch = await server.inject({
      method: 'POST', url: '/v1/inventory/dispatches', headers,
      payload: {
        allocationId: allocation.json().id, quantityKg: '1.000',
        dispatchedAt: '2026-10-02T11:00:00-03:00', vehiclePlate: 'PQR-7S89',
        documentReference: 'NF-TESTE-51', notes: null,
      },
    });
    expect(dispatch.json()).toMatchObject({ calculationStatus: 'PENDING_ROUNDING_POLICY' });
    const title = await server.inject({
      method: 'POST', url: '/v1/finance/titles', headers,
      payload: {
        financialEventId: dispatch.json().financialEventId, titleNumber: 'TR-2026-0051',
        documentReference: 'NFE-TESTE-51', dueDate: '2026-10-12',
      },
    });
    expect(title.statusCode).toBe(409);
    expect(title.json()).toMatchObject({ code: 'ROUNDING_POLICY_REQUIRED' });
  });
});
