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
const documentId = 'e4000000-0000-4000-8000-000000000001';

describe.runIf(Boolean(databaseUrl))('fiscal document registry', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    const setup = new Pool({ connectionString: databaseUrl });
    await setup.query('DROP SCHEMA IF EXISTS control CASCADE');
    await setup.query('DROP SCHEMA IF EXISTS app CASCADE');
    for (const migration of [
      '20261001000100_commercial_foundation.sql', '20261001000200_outbox_read_models.sql',
      '20261001000300_commercial_governance.sql', '20261001193311_harden_tenant_rls.sql',
      '20261001194949_optimize_tenant_rls.sql', '20261001224302_control_plane_access.sql',
      '20261001224527_index_control_invitation_inviter.sql', '20261002030013_operations_load_scheduling.sql',
      '20261002031951_grant_operations_runtime.sql', '20261002042905_demo_tenant_contract_portfolio.sql',
      '20261002162513_operations_receiving_quality.sql', '20261002163915_grant_demo_reset_load_receipts.sql',
      '20261002174124_inventory_receipt_ledger.sql', '20261002211618_sales_fulfillment_slice.sql',
      '20261002220831_financial_receivables_slice.sql', '20261002224025_risk_position_slice.sql',
      '20261002224945_cover_operational_foreign_keys.sql', '20261002234414_fiscal_document_registry.sql',
      '20261003000202_cover_fiscal_source_foreign_key.sql',
    ]) {
      await setup.query(await readFile(new URL(`../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await setup.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await setup.query('UPDATE app.tenants SET is_demo=true WHERE id=$1', [tenantId]);
    await resetDemoTenant(setup, { tenantId, actorId });
    await setup.end();

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'development';
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: ['error'], abortOnError: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => app?.close());

  it('loads the persisted demo document and keeps tax calculation blocked', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET', url: '/v1/fiscal', headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      tenant: { isDemo: true, demoSeedVersion: 7 },
      summary: { received: 1, validated: 0, rejected: 0, linkedTitles: 0 },
      documents: [{
        id: documentId, contractReference: 'CV-2026-0042', documentNumber: 'NFE-DEMO-0001',
        totalAmount: '11360.00', expectedAmount: '11360.00', differenceAmount: '0.00', status: 'RECEIVED',
      }],
      taxCalculation: { status: 'BLOCKED_CONFIGURATION' },
    });
  });

  it('prevents a divergent value, accepts a correction and links the title on validation', async () => {
    const server = app.getHttpAdapter().getInstance();
    const wrong = await server.inject({
      method: 'PATCH', url: `/v1/fiscal/documents/${documentId}`, headers,
      payload: {
        documentNumber: 'NFE-DEMO-0001', accessKey: '99000000000000000000000000000000000000000001',
        issuedAt: '2026-10-01T13:10:00-03:00', totalAmount: '11361.00',
        validationNotes: 'Valor divergente proposital para teste.',
      },
    });
    expect(wrong.statusCode, wrong.body).toBe(200);
    const blocked = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${documentId}/validate`, headers,
    });
    expect(blocked.statusCode).toBe(422);
    expect(blocked.json()).toMatchObject({
      code: 'FISCAL_DOCUMENT_VALUE_DIVERGENCE', expectedAmount: '11360.00', difference: '1.00',
    });

    const corrected = await server.inject({
      method: 'PATCH', url: `/v1/fiscal/documents/${documentId}`, headers,
      payload: {
        documentNumber: 'NFE-DEMO-0001', accessKey: '99000000000000000000000000000000000000000001',
        issuedAt: '2026-10-01T13:10:00-03:00', totalAmount: '11360.00',
        validationNotes: 'Documento conferido contra a expedição e o evento financeiro.',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    const validated = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${documentId}/validate`, headers,
    });
    expect(validated.statusCode, validated.body).toBe(201);
    expect(validated.json()).toMatchObject({ status: 'VALIDATED', linkedTitleId: expect.any(String) });

    const workspace = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(workspace.json()).toMatchObject({
      summary: { received: 0, validated: 1, rejected: 0, linkedTitles: 1 },
      documents: [{ status: 'VALIDATED', title: { number: 'TR-2026-0001' } }],
    });
  });

  it('rejects without erasing the document and removes the title link', async () => {
    const server = app.getHttpAdapter().getInstance();
    const rejected = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${documentId}/reject`, headers,
      payload: { reason: 'Documento rejeitado para demonstrar a correção controlada.' },
    });
    expect(rejected.statusCode, rejected.body).toBe(201);
    const workspace = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(workspace.json()).toMatchObject({
      summary: { received: 0, validated: 0, rejected: 1, linkedTitles: 0 },
      documents: [{ status: 'REJECTED', title: null }],
    });
  });
});
