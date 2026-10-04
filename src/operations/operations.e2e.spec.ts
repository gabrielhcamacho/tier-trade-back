import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { resetDemoTenant } from '../demo/demo-seed.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const loadId = 'd7000000-0000-4000-8000-000000000003';
const headers = { 'x-tenant-id': tenantId, 'x-actor-id': actorId };

describe.runIf(Boolean(databaseUrl))('operations yard, occurrences and romaneio', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    const setup = new Pool({ connectionString: databaseUrl });
    await setup.query('DROP SCHEMA IF EXISTS control CASCADE');
    await setup.query('DROP SCHEMA IF EXISTS app CASCADE');
    const migrationDirectory = new URL('../../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
    for (const migration of migrations) {
      await setup.query(await readFile(new URL(migration, migrationDirectory), 'utf8'));
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

  it('runs check-in, yard queue, accepted receipt, occurrence resolution and versioned romaneio', async () => {
    const server = app.getHttpAdapter().getInstance();
    const started = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/start-receiving`, headers,
    });
    expect(started.statusCode, started.body).toBe(201);

    for (const [eventType, occurredAt, locationCode] of [
      ['QUEUED', '2026-10-22T09:05:00-03:00', 'PATIO_B'],
      ['CALLED_TO_SCALE', '2026-10-22T09:20:00-03:00', 'BALANCA_02'],
    ] as const) {
      const event = await server.inject({
        method: 'POST', url: `/v1/loads/${loadId}/yard-events`, headers,
        payload: { eventType, occurredAt, locationCode, notes: null },
      });
      expect(event.statusCode, event.body).toBe(201);
    }

    const occurrence = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/occurrences`, headers,
      payload: {
        category: 'DOCUMENT', severity: 'WARNING', title: 'Conferência da NF de entrada',
        description: 'A chave da nota fiscal foi conferida manualmente antes da pesagem.',
        occurredAt: '2026-10-22T09:22:00-03:00',
      },
    });
    expect(occurrence.statusCode, occurrence.body).toBe(201);
    expect(occurrence.json()).toMatchObject({ status: 'OPEN', category: 'DOCUMENT' });

    const receiptPayload = {
      receivedAt: '2026-10-22T09:40:00-03:00',
      inboundInvoiceNumber: 'NF-TESTE-0045', inboundInvoiceSeries: '1',
      inboundInvoiceAccessKey: '51261012345678000190550010000001231000001234',
      documentWeightKg: '44980.000', grossWeightKg: '60000.000', tareWeightKg: '15000.000',
      consideredWeightKg: '45000.000', acceptedWeightKg: '45000.000',
      weightDecisionReason: 'Peso documental vinte quilos abaixo da pesagem aceita.',
      weighingMode: 'SCALE', scaleTicketNumber: 'BAL-TESTE-0045', contingencyReason: null,
      moisturePct: '13.5000', impurityPct: '1.2500', damagedPct: '2.1000',
      qualityDecision: 'ACCEPTED', notes: 'Fluxo operacional autenticado de teste.',
    };
    const receipt = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/receipt`, headers, payload: receiptPayload,
    });
    expect(receipt.statusCode, receipt.body).toBe(200);

    const earlyDeparture = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/yard-events`, headers,
      payload: { eventType: 'DEPARTED', occurredAt: '2026-10-22T09:50:00-03:00', locationCode: 'PORTARIA_02', notes: null },
    });
    expect(earlyDeparture.statusCode).toBe(409);

    const released = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/yard-events`, headers,
      payload: {
        eventType: 'RELEASED', occurredAt: '2026-10-22T09:50:00-03:00',
        locationCode: 'PORTARIA_02', notes: 'Carga liberada após aceite do recebimento.',
      },
    });
    expect(released.statusCode, released.body).toBe(201);
    const departed = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/yard-events`, headers,
      payload: { eventType: 'DEPARTED', occurredAt: '2026-10-22T10:00:00-03:00', locationCode: 'PORTARIA_02', notes: null },
    });
    expect(departed.statusCode, departed.body).toBe(201);

    const resolved = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/occurrences/${occurrence.json().id}/resolve`, headers,
      payload: { resolution: 'Documento conferido e liberado pelo responsável operacional.' },
    });
    expect(resolved.statusCode, resolved.body).toBe(201);
    expect(resolved.json()).toMatchObject({ status: 'RESOLVED' });

    const firstReport = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/romaneio`, headers,
    });
    expect(firstReport.statusCode, firstReport.body).toBe(201);
    expect(firstReport.json()).toMatchObject({ version: 1, acceptedWeightKg: '45000.000' });
    const idempotent = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/romaneio`, headers,
    });
    expect(idempotent.statusCode, idempotent.body).toBe(201);
    expect(idempotent.json().id).toBe(firstReport.json().id);

    const corrected = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/receipt`, headers,
      payload: { ...receiptPayload, consideredWeightKg: '44990.000', acceptedWeightKg: '44990.000',
        weightDecisionReason: 'Contraprova determinou peso aceito dez quilos abaixo da pesagem.' },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    const secondReport = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/romaneio`, headers,
    });
    expect(secondReport.statusCode, secondReport.body).toBe(201);
    expect(secondReport.json()).toMatchObject({ version: 2, acceptedWeightKg: '44990.000' });

    const detail = await server.inject({ method: 'GET', url: `/v1/loads/${loadId}`, headers });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json()).toMatchObject({
      yardState: 'DEPARTED',
      romaneio: { version: 2, isCurrent: true, acceptedWeightKg: '44990.000' },
      occurrences: [{ id: occurrence.json().id, status: 'RESOLVED' }],
    });
    expect(detail.json().yardEvents).toHaveLength(5);
    expect(detail.json().romaneioHistory).toHaveLength(2);

    const yardBoard = await server.inject({ method: 'GET', url: '/v1/operations/yard', headers });
    expect(yardBoard.statusCode, yardBoard.body).toBe(200);
    expect(yardBoard.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: loadId, yardState: 'DEPARTED', openOccurrences: 0 }),
    ]));
    const occurrenceBoard = await server.inject({ method: 'GET', url: '/v1/operations/occurrences', headers });
    expect(occurrenceBoard.statusCode, occurrenceBoard.body).toBe(200);
    expect(occurrenceBoard.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: occurrence.json().id, loadId, status: 'RESOLVED' }),
    ]));
  });
});
