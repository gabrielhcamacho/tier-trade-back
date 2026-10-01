import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { createCorsOptions } from '../http/cors.js';
import { OutboxProcessor } from '../outbox/outbox.processor.js';

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
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000100_commercial_foundation.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000200_outbox_read_models.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000300_commercial_governance.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001193311_harden_tenant_rls.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001194949_optimize_tenant_rls.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await setup.end();

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'development';
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    app.enableCors(createCorsOptions('http://localhost:3000'));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('moves an offer requiring approval through to an active contract', async () => {
    const server = app.getHttpAdapter().getInstance();
    const preflight = await server.inject({
      method: 'OPTIONS',
      url: '/v1/settings/margin-policy',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type,x-tenant-id',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');

    const counterparty = await server.inject({
      method: 'POST', url: '/v1/counterparties', headers: identityHeaders,
      payload: { legalName: 'Cooperativa Teste do Cerrado', taxId: '12.345.678/0001-90' },
    });
    expect(counterparty.statusCode).toBe(201);
    expect(counterparty.json()).toMatchObject({ legalName: 'Cooperativa Teste do Cerrado', taxId: '12345678000190' });

    const policy = await server.inject({
      method: 'PATCH', url: '/v1/settings/margin-policy', headers: identityHeaders,
      payload: { commodity: 'MILHO', autoApprovalMarginPerSc: '5.00', absoluteFloorMarginPerSc: '1.00' },
    });
    expect(policy.statusCode).toBe(200);
    expect(policy.json()).toMatchObject({ version: 2, autoApprovalMarginPerSc: '5.00' });

    const offerInput = {
      counterpartyId: counterparty.json().id, commodity: 'MILHO', unit: 'SC_60KG',
      quantitySc: '10000', deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30',
      purchasePricePerSc: '60.00', saleReferencePerSc: '67.50',
      costs: [{ code: 'FREIGHT', amountPerSc: '4.00' }, { code: 'STORAGE', amountPerSc: '1.00' }],
    };
    const created = await server.inject({
      method: 'POST', url: '/v1/offers', headers: identityHeaders,
      payload: offerInput,
    });
    expect(created.statusCode).toBe(201);
    let offer = created.json();
    expect(offer.pricing.projectedMarginPerSc).toBe('2.50');
    const edited = await server.inject({
      method: 'PUT', url: `/v1/offers/${offer.offerId}`, headers: identityHeaders,
      payload: { ...offerInput, saleReferencePerSc: '68.00' },
    });
    expect(edited.statusCode).toBe(200);
    offer = edited.json();
    expect(offer).toMatchObject({ scenarioVersion: 2, policyVersion: 2 });
    expect(offer.pricing.projectedMarginPerSc).toBe('3.00');

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

    const cancellable = await server.inject({
      method: 'POST', url: '/v1/offers', headers: identityHeaders, payload: offerInput,
    });
    const cancellableOffer = cancellable.json();
    const cancellableSubmission = await server.inject({
      method: 'POST', url: `/v1/offers/${cancellableOffer.offerId}/submit`, headers: identityHeaders,
    });
    expect(cancellableSubmission.statusCode).toBe(201);
    expect(cancellableSubmission.json().decision).toBe('APPROVAL_REQUIRED');
    const cancellableApproval = await server.inject({
      method: 'POST',
      url: `/v1/approvals/${cancellableSubmission.json().approvalId}/approve`,
      headers: identityHeaders,
    });
    expect(cancellableApproval.statusCode).toBe(201);
    expect(cancellableApproval.json().status).toBe('APPROVED');
    const cancellationReason = 'Homologação: cancelamento controlado antes da ativação do contrato.';
    const cancelled = await server.inject({
      method: 'POST', url: `/v1/offers/${cancellableOffer.offerId}/cancel`, headers: identityHeaders,
      payload: { reason: cancellationReason },
    });
    expect(cancelled.statusCode).toBe(201);
    expect(cancelled.json()).toMatchObject({ status: 'CANCELLED', reason: cancellationReason });
    const invalidSubmission = await server.inject({
      method: 'POST', url: `/v1/offers/${cancellableOffer.offerId}/submit`, headers: identityHeaders,
    });
    expect(invalidSubmission.statusCode).toBe(409);

    const belowFloor = await server.inject({
      method: 'POST',
      url: '/v1/offers',
      headers: identityHeaders,
      payload: { ...offerInput, saleReferencePerSc: '65.50' },
    });
    expect(belowFloor.statusCode).toBe(201);
    expect(belowFloor.json().pricing.projectedMarginPerSc).toBe('0.50');
    const blockedSubmission = await server.inject({
      method: 'POST', url: `/v1/offers/${belowFloor.json().offerId}/submit`, headers: identityHeaders,
    });
    expect(blockedSubmission.statusCode).toBe(422);
    expect(blockedSubmission.json()).toMatchObject({ code: 'MARGIN_BELOW_ABSOLUTE_FLOOR' });

    const processor = app.get(OutboxProcessor);
    const firstPass = await processor.processTenant(identityHeaders['x-tenant-id']);
    expect(firstPass).toEqual({ claimed: 12, published: 12, failed: 0 });
    expect(await processor.processTenant(identityHeaders['x-tenant-id'])).toEqual({
      claimed: 0, published: 0, failed: 0,
    });

    const verification = new Pool({ connectionString: databaseUrl });
    const activity = await verification.query<{ count: string }>(
      'SELECT count(*) FROM app.commercial_activity_read_model WHERE tenant_id=$1',
      [identityHeaders['x-tenant-id']],
    );
    const projection = await verification.query<{
      projected_margin_per_sc: string;
      obligations: Array<{ code: string; status: string }>;
    }>(
      `SELECT projected_margin_per_sc,obligations FROM app.contract_summary_read_model
        WHERE tenant_id=$1 AND contract_id=$2`,
      [identityHeaders['x-tenant-id'], contract.contractId],
    );
    const cancellationAudit = await verification.query<{ payload: { previousStatus: string; reason: string } }>(
      `SELECT payload FROM app.audit_events
        WHERE tenant_id=$1 AND aggregate_id=$2 AND event_type='offer.cancelled'`,
      [identityHeaders['x-tenant-id'], cancellableOffer.offerId],
    );
    expect(activity.rows[0]?.count).toBe('12');
    expect(projection.rows[0]?.projected_margin_per_sc).toBe('3.000000');
    expect(projection.rows[0]?.obligations).toHaveLength(2);
    expect(cancellationAudit.rows[0]?.payload).toEqual({
      previousStatus: 'APPROVED',
      reason: cancellationReason,
    });

    const invalidEventId = randomUUID();
    await verification.query(
      `INSERT INTO app.outbox_events
        (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,'contract.activated','contract',$3,'{}'::jsonb)`,
      [identityHeaders['x-tenant-id'], invalidEventId, randomUUID()],
    );
    const failedPass = await processor.processTenant(identityHeaders['x-tenant-id']);
    expect(failedPass).toEqual({ claimed: 1, published: 0, failed: 1 });
    const retry = await verification.query<{
      attempts: number;
      locked_at: Date | null;
      last_error: string | null;
      delayed: boolean;
    }>(
      `SELECT attempts,locked_at,last_error,available_at > now() AS delayed
         FROM app.outbox_events WHERE tenant_id=$1 AND id=$2`,
      [identityHeaders['x-tenant-id'], invalidEventId],
    );
    expect(retry.rows[0]).toMatchObject({
      attempts: 1,
      locked_at: null,
      last_error: 'CONTRACT_PROJECTION_SOURCE_NOT_FOUND',
      delayed: true,
    });
    await verification.end();
  });
});
