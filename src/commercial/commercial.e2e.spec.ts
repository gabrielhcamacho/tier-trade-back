import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const identityHeaders = {
  'x-tenant-id': '11111111-1111-4111-8111-111111111111',
  'x-actor-id': '22222222-2222-4222-8222-222222222222',
};

describe.runIf(Boolean(databaseUrl))('commercial HTTP flow with PostgreSQL', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    const setup = new Pool({ connectionString: databaseUrl });
    await setup.query('DROP SCHEMA IF EXISTS app CASCADE');
    await setup.query(await readFile(new URL('../../migrations/0001_commercial_foundation.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await setup.end();

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'development';
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('moves an offer requiring approval through to an active contract', async () => {
    const server = app.getHttpAdapter().getInstance();
    const created = await server.inject({
      method: 'POST', url: '/v1/offers', headers: identityHeaders,
      payload: {
        counterpartyId: '33333333-3333-4333-8333-333333333333', commodity: 'MILHO', unit: 'SC_60KG',
        quantitySc: '10000', deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30',
        purchasePricePerSc: '60.00', saleReferencePerSc: '67.50',
        costs: [{ code: 'FREIGHT', amountPerSc: '4.00' }, { code: 'STORAGE', amountPerSc: '1.00' }],
      },
    });
    expect(created.statusCode).toBe(201);
    const offer = created.json();
    expect(offer.pricing.projectedMarginPerSc).toBe('2.50');

    const submitted = await server.inject({ method: 'POST', url: `/v1/offers/${offer.offerId}/submit`, headers: identityHeaders });
    expect(submitted.statusCode).toBe(201);
    const approval = submitted.json();
    expect(approval.decision).toBe('APPROVAL_REQUIRED');

    const approved = await server.inject({ method: 'POST', url: `/v1/approvals/${approval.approvalId}/approve`, headers: identityHeaders });
    expect(approved.json().status).toBe('APPROVED');

    const activated = await server.inject({ method: 'POST', url: `/v1/offers/${offer.offerId}/activate-contract`, headers: identityHeaders });
    expect(activated.statusCode).toBe(201);
    const contract = activated.json();

    const summary = await server.inject({ method: 'GET', url: `/v1/contracts/${contract.contractId}/summary`, headers: identityHeaders });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({ status: 'ACTIVE' });
    expect(summary.json().obligations).toHaveLength(2);
  });
});
