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
    await setup.query('DROP SCHEMA IF EXISTS control CASCADE');
    await setup.query('DROP SCHEMA IF EXISTS app CASCADE');
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000100_commercial_foundation.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000200_outbox_read_models.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001000300_commercial_governance.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001193311_harden_tenant_rls.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001194949_optimize_tenant_rls.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001224302_control_plane_access.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261001224527_index_control_invitation_inviter.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002030013_operations_load_scheduling.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002042905_demo_tenant_contract_portfolio.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002162513_operations_receiving_quality.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002163915_grant_demo_reset_load_receipts.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002174124_inventory_receipt_ledger.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002211618_sales_fulfillment_slice.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002220831_financial_receivables_slice.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002224025_risk_position_slice.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002224945_cover_operational_foreign_keys.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261002234414_fiscal_document_registry.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261003000202_cover_fiscal_source_foreign_key.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261003003904_fiscal_configuration_catalog.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261003011929_fiscal_calculation_engine.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261003014022_fiscal_obligations_and_financial_effects.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261003194521_fiscal_payments_and_cash_flow.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261004155718_phase1_commodity_and_counterparty_profile.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261004164744_sales_contract_versions.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261004221411_operations_receipt_document_weights.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261004224629_cover_sales_contract_version_recorder_fk.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261004234000_operations_yard_occurrences_romaneio.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005002533_purchase_fiscal_payables.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005003926_cover_purchase_operation_foreign_keys.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005004718_preserve_outbound_fiscal_source_integrity.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005010100_grant_purchase_finance_runtime.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005021155_finance_governance_and_realized_margin.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005023251_cover_finance_governance_foreign_keys.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005160713_operational_completeness_foundation.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005160901_cover_operational_completeness_foreign_keys.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005161634_demo_reset_operational_completeness.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261005213800_contract_obligation_workflow.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../../supabase/migrations/20261007205930_purchase_contract_terms.sql', import.meta.url), 'utf8'));
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

  it('serves the tenant-scoped overview and rejects unmodeled filters', async () => {
    const server = app.getHttpAdapter().getInstance();
    const overview = await server.inject({ method: 'GET', url: '/v1/overview?commodity=MILHO',
      headers: identityHeaders });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({ contractVersion: 1, consistency: 'MULTI_TRANSACTION',
      filters: { commodity: 'MILHO', financeScope: 'TENANT_CONSOLIDATED' },
      indicators: { pendingApprovalCount: 0 }, access: { scope: 'TENANT' } });
    const unsupported = await server.inject({ method: 'GET', url: '/v1/overview?crop=25%2F26',
      headers: identityHeaders });
    expect(unsupported.statusCode).toBe(400);
    expect(unsupported.json()).toMatchObject({ code: 'OVERVIEW_FILTER_NOT_MODELED' });
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
      payload: { legalName: 'Cooperativa Teste do Cerrado', taxId: '12.345.678/0001-90', partyType: 'COOPERATIVE' },
    });
    expect(counterparty.statusCode).toBe(201);
    expect(counterparty.json()).toMatchObject({ legalName: 'Cooperativa Teste do Cerrado', taxId: '12345678000190', partyType: 'COOPERATIVE' });

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
    const listed = await server.inject({ method: 'GET', url: '/v1/offers', headers: identityHeaders });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: offer.offerId, counterparty_name: counterparty.json().legalName,
        commodity: 'MILHO', status: 'DRAFT' }),
    ]));
    const offerDetail = await server.inject({ method: 'GET', url: `/v1/offers/${offer.offerId}`, headers: identityHeaders });
    expect(offerDetail.statusCode).toBe(200);
    expect(offerDetail.json()).toMatchObject({
      offerId: offer.offerId, status: 'DRAFT', counterpartyId: counterparty.json().id,
      quantitySc: '10000.000000', purchasePricePerSc: '60.000000',
      costs: offerInput.costs, scenarioVersion: 1, policyVersion: 2,
      approval: null, contractId: null,
    });
    const edited = await server.inject({
      method: 'PUT', url: `/v1/offers/${offer.offerId}`, headers: identityHeaders,
      payload: { ...offerInput, saleReferencePerSc: '68.00' },
    });
    expect(edited.statusCode).toBe(200);
    offer = edited.json();
    expect(offer).toMatchObject({ scenarioVersion: 2, policyVersion: 2 });
    expect(offer.pricing.projectedMarginPerSc).toBe('3.00');
    const repricedDetail = await server.inject({ method: 'GET', url: `/v1/offers/${offer.offerId}`, headers: identityHeaders });
    expect(repricedDetail.json()).toMatchObject({ scenarioVersion: 2, saleReferencePerSc: '68.000000' });

    const submitted = await server.inject({ method: 'POST', url: `/v1/offers/${offer.offerId}/submit`, headers: identityHeaders });
    expect(submitted.statusCode).toBe(201);
    const approval = submitted.json();
    expect(approval.decision).toBe('APPROVAL_REQUIRED');

    const approved = await server.inject({ method: 'POST', url: `/v1/approvals/${approval.approvalId}/approve`, headers: identityHeaders });
    expect(approved.json().status).toBe('APPROVED');

    const activated = await server.inject({ method: 'POST', url: `/v1/offers/${offer.offerId}/activate-contract`, headers: identityHeaders });
    expect(activated.statusCode).toBe(201);
    const contract = activated.json();
    const convertedDetail = await server.inject({ method: 'GET', url: `/v1/offers/${offer.offerId}`, headers: identityHeaders });
    expect(convertedDetail.json()).toMatchObject({
      status: 'CONVERTED', contractId: contract.contractId,
      approval: { id: approval.approvalId, status: 'APPROVED' },
    });

    const summary = await server.inject({ method: 'GET', url: `/v1/contracts/${contract.contractId}/summary`, headers: identityHeaders });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({ status: 'ACTIVE' });
    expect(summary.json().obligations).toHaveLength(2);
    expect(summary.json().purchase_terms).toBeNull();

    const termsInput = {
      expectedVersion: 0,
      externalNumber: 'COMPRA-TESTE-01',
      cropYear: '2025/26',
      signedOn: '2026-10-06',
      pickupLocation: 'Fazenda Teste, MT',
      deliveryCondition: 'Sobre rodas',
      freightPayer: 'BUYER',
      weighingResponsibility: 'Vendedor',
      qualityTerms: 'Classificação por carga; descontos sujeitos a tabela homologada.',
      requiredDocuments: 'NF, romaneio e laudo de classificação.',
      paymentTerms: 'Pagamento por carga conforme conferência documental.',
    };
    const savedTerms = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/purchase-terms`,
      headers: identityHeaders, payload: termsInput,
    });
    expect(savedTerms.statusCode, savedTerms.body).toBe(200);
    expect(savedTerms.json()).toMatchObject({ externalNumber: termsInput.externalNumber, version: 1 });
    const staleTerms = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/purchase-terms`,
      headers: identityHeaders, payload: termsInput,
    });
    expect(staleTerms.statusCode).toBe(409);
    const revisedTerms = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/purchase-terms`,
      headers: identityHeaders,
      payload: { ...termsInput, expectedVersion: 1, requiredDocuments: 'NF, romaneio, laudo e CT-e.' },
    });
    expect(revisedTerms.statusCode, revisedTerms.body).toBe(200);
    expect(revisedTerms.json()).toMatchObject({ version: 2, requiredDocuments: 'NF, romaneio, laudo e CT-e.' });
    const isolatedTerms = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/purchase-terms`,
      headers: { ...identityHeaders, 'x-tenant-id': '99999999-9999-4999-8999-999999999999' },
      payload: termsInput,
    });
    expect(isolatedTerms.statusCode).toBe(404);
    const termsSummary = await server.inject({
      method: 'GET', url: `/v1/contracts/${contract.contractId}/summary`, headers: identityHeaders,
    });
    expect(termsSummary.json().purchase_terms).toMatchObject({
      externalNumber: termsInput.externalNumber, cropYear: termsInput.cropYear, version: 2,
    });
    expect(termsSummary.json().purchase_price_per_sc).toBe('60.000000');

    const createdObligation = await server.inject({
      method: 'POST', url: `/v1/contracts/${contract.contractId}/obligations`, headers: identityHeaders,
      payload: {
        title: 'Conferir garantia contratual',
        description: 'Validar o documento anexado antes da primeira entrega.',
        dueDate: '2026-11-05',
        responsibleName: 'Equipe de contratos',
      },
    });
    expect(createdObligation.statusCode, createdObligation.body).toBe(201);
    expect(createdObligation.json()).toMatchObject({
      title: 'Conferir garantia contratual', due_date: '2026-11-05',
      responsible_name: 'Equipe de contratos', status: 'PENDING',
    });
    const obligationId = createdObligation.json().id as string;
    const openObligations = await server.inject({
      method: 'GET', url: '/v1/contracts/obligations/open', headers: identityHeaders,
    });
    expect(openObligations.statusCode, openObligations.body).toBe(200);
    expect(openObligations.json().hasMore).toBe(false);
    expect(openObligations.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: obligationId, contract_id: contract.contractId,
        due_date: '2026-11-05', title: 'Conferir garantia contratual', status: 'PENDING' }),
    ]));
    const obligationInput = {
      title: 'Conferir garantia contratual',
      description: 'Validar o documento anexado antes da primeira entrega.',
      dueDate: '2026-11-05',
      responsibleName: 'Equipe de contratos',
    };
    const completedObligation = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/obligations/${obligationId}`,
      headers: identityHeaders, payload: { ...obligationInput, status: 'COMPLETED' },
    });
    expect(completedObligation.statusCode, completedObligation.body).toBe(200);
    expect(completedObligation.json()).toMatchObject({ status: 'COMPLETED' });
    expect(completedObligation.json().completed_at).not.toBeNull();
    const reopenedObligation = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/obligations/${obligationId}`,
      headers: identityHeaders, payload: { ...obligationInput, status: 'PENDING' },
    });
    expect(reopenedObligation.statusCode, reopenedObligation.body).toBe(200);
    expect(reopenedObligation.json()).toMatchObject({ status: 'PENDING', completed_at: null });
    const cancelledObligation = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/obligations/${obligationId}`,
      headers: identityHeaders, payload: { ...obligationInput, status: 'CANCELLED' },
    });
    expect(cancelledObligation.statusCode, cancelledObligation.body).toBe(200);
    expect(cancelledObligation.json()).toMatchObject({ status: 'CANCELLED', completed_at: null });
    const queueAfterCancel = await server.inject({
      method: 'GET', url: '/v1/contracts/obligations/open', headers: identityHeaders,
    });
    expect(queueAfterCancel.json().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: obligationId }),
    ]));
    const isolatedObligationUpdate = await server.inject({
      method: 'PUT', url: `/v1/contracts/${contract.contractId}/obligations/${obligationId}`,
      headers: { ...identityHeaders, 'x-tenant-id': '99999999-9999-4999-8999-999999999999' },
      payload: { ...obligationInput, status: 'PENDING' },
    });
    expect(isolatedObligationUpdate.statusCode).toBe(404);
    const summaryWithObligation = await server.inject({
      method: 'GET', url: `/v1/contracts/${contract.contractId}/summary`, headers: identityHeaders,
    });
    expect(summaryWithObligation.json().obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: obligationId, title: obligationInput.title, due_date: obligationInput.dueDate,
        responsible_name: obligationInput.responsibleName, status: 'CANCELLED',
      }),
    ]));

    const scheduledLoad = await server.inject({
      method: 'POST', url: `/v1/contracts/${contract.contractId}/loads`, headers: identityHeaders,
      payload: {
        scheduledLocal: '2026-11-10T08:30',
        expectedWeightKg: '48000.000',
        vehiclePlate: 'RBC-7H55',
        carrierName: 'Rodogrãos',
        destinationCode: 'ARM-RV01',
      },
    });
    expect(scheduledLoad.statusCode, scheduledLoad.body).toBe(201);
    expect(scheduledLoad.json()).toMatchObject({
      contractId: contract.contractId,
      expectedWeightKg: '48000.000',
      vehiclePlate: 'RBC7H55',
      status: 'SCHEDULED',
      contractBalanceKg: '552000.000',
    });
    const agenda = await server.inject({
      method: 'GET', url: `/v1/contracts/${contract.contractId}/loads`, headers: identityHeaders,
    });
    expect(agenda.statusCode).toBe(200);
    expect(agenda.json()).toMatchObject({
      summary: { count: 1, scheduledWeightKg: '48000.000', availableWeightKg: '552000.000' },
    });
    expect(agenda.json().items).toHaveLength(1);
    const loadId = scheduledLoad.json().id as string;
    const rescheduleInput = {
      scheduledLocal: '2026-11-11T09:15', expectedWeightKg: '50000.000',
      vehiclePlate: 'RBC-7H55', carrierName: 'Rodogrãos', destinationCode: 'ARM-RV01',
      reason: 'Reagendamento solicitado pela transportadora.',
    };
    const outsideWindow = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/schedule`, headers: identityHeaders,
      payload: { ...rescheduleInput, scheduledLocal: '2026-12-01T09:15' },
    });
    expect(outsideWindow.statusCode).toBe(422);
    expect(outsideWindow.json()).toMatchObject({ code: 'LOAD_OUTSIDE_CONTRACT_DELIVERY_WINDOW' });
    const overBalance = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/schedule`, headers: identityHeaders,
      payload: { ...rescheduleInput, expectedWeightKg: '600001.000' },
    });
    expect(overBalance.statusCode).toBe(422);
    expect(overBalance.json()).toMatchObject({ code: 'LOAD_EXCEEDS_CONTRACT_BALANCE' });
    const rescheduled = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/schedule`, headers: identityHeaders,
      payload: rescheduleInput,
    });
    expect(rescheduled.statusCode, rescheduled.body).toBe(200);
    expect(rescheduled.json()).toMatchObject({ expectedWeightKg: '50000.000', contractBalanceKg: '550000.000' });
    const otherTenantCannotEdit = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/schedule`,
      headers: { ...identityHeaders, 'x-tenant-id': '99999999-9999-4999-8999-999999999999' },
      payload: rescheduleInput,
    });
    expect(otherTenantCannotEdit.statusCode).toBe(404);
    const expendable = await server.inject({
      method: 'POST', url: `/v1/contracts/${contract.contractId}/loads`, headers: identityHeaders,
      payload: { ...rescheduleInput, expectedWeightKg: '2000.000' },
    });
    expect(expendable.statusCode).toBe(201);
    const cancelledLoad = await server.inject({
      method: 'POST', url: `/v1/loads/${expendable.json().id}/cancel`, headers: identityHeaders,
      payload: { reason: 'Veículo indisponível antes da chegada ao armazém.' },
    });
    expect(cancelledLoad.statusCode, cancelledLoad.body).toBe(201);
    expect(cancelledLoad.json()).toMatchObject({ status: 'CANCELLED' });
    const balanceAfterCancellation = await server.inject({
      method: 'GET', url: `/v1/contracts/${contract.contractId}/loads`, headers: identityHeaders,
    });
    expect(balanceAfterCancellation.json()).toMatchObject({
      summary: { count: 2, scheduledWeightKg: '50000.000', availableWeightKg: '550000.000' },
    });
    const cancelledDetail = await server.inject({
      method: 'GET', url: `/v1/loads/${expendable.json().id}`, headers: identityHeaders,
    });
    expect(cancelledDetail.json().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'load.cancelled', payload: expect.objectContaining({ releasedWeightKg: '2000.000' }) }),
    ]));
    const rescheduledDetail = await server.inject({
      method: 'GET', url: `/v1/loads/${loadId}`, headers: identityHeaders,
    });
    expect(rescheduledDetail.json().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'load.rescheduled', payload: expect.objectContaining({ reason: rescheduleInput.reason }) }),
    ]));
    const noRepeatCancellation = await server.inject({
      method: 'POST', url: `/v1/loads/${expendable.json().id}/cancel`, headers: identityHeaders,
      payload: { reason: 'Tentativa duplicada de cancelamento da carga.' },
    });
    expect(noRepeatCancellation.statusCode).toBe(409);
    const started = await server.inject({
      method: 'POST', url: `/v1/loads/${scheduledLoad.json().id}/start-receiving`, headers: identityHeaders,
    });
    expect(started.statusCode).toBe(201);
    expect(started.json().status).toBe('IN_RECEIVING');
    const noRescheduleAfterArrival = await server.inject({
      method: 'PUT', url: `/v1/loads/${loadId}/schedule`, headers: identityHeaders,
      payload: rescheduleInput,
    });
    expect(noRescheduleAfterArrival.statusCode).toBe(409);
    const noCancelAfterArrival = await server.inject({
      method: 'POST', url: `/v1/loads/${loadId}/cancel`, headers: identityHeaders,
      payload: { reason: 'Não é permitido cancelar após iniciar recebimento.' },
    });
    expect(noCancelAfterArrival.statusCode).toBe(409);
    const invalidWeights = await server.inject({
      method: 'PUT', url: `/v1/loads/${scheduledLoad.json().id}/receipt`, headers: identityHeaders,
      payload: {
        receivedAt: '2026-11-10T12:00:00-03:00', grossWeightKg: '15000.000', tareWeightKg: '16000.000',
        inboundInvoiceNumber: 'NF-TESTE-1', inboundInvoiceSeries: '1', inboundInvoiceAccessKey: null,
        documentWeightKg: '33000.000', consideredWeightKg: '33000.000', acceptedWeightKg: '33000.000',
        weightDecisionReason: 'Pesos divergentes usados exclusivamente no cenário inválido do teste.',
        weighingMode: 'SCALE', scaleTicketNumber: 'TB-TESTE-1', contingencyReason: null,
        moisturePct: '13.2', impurityPct: '1.1', damagedPct: '2.3', qualityDecision: 'ACCEPTED', notes: null,
      },
    });
    expect(invalidWeights.statusCode).toBe(422);
    expect(invalidWeights.json()).toMatchObject({ code: 'GROSS_WEIGHT_MUST_EXCEED_TARE' });
    const receipt = await server.inject({
      method: 'PUT', url: `/v1/loads/${scheduledLoad.json().id}/receipt`, headers: identityHeaders,
      payload: {
        receivedAt: '2026-11-10T12:00:00-03:00', grossWeightKg: '48000.000', tareWeightKg: '15000.000',
        inboundInvoiceNumber: 'NF-TESTE-1', inboundInvoiceSeries: '1', inboundInvoiceAccessKey: null,
        documentWeightKg: '33000.000', consideredWeightKg: '33000.000', acceptedWeightKg: '33000.000',
        weightDecisionReason: null,
        weighingMode: 'SCALE', scaleTicketNumber: 'TB-TESTE-1', contingencyReason: null,
        moisturePct: '13.2', impurityPct: '1.1', damagedPct: '2.3', qualityDecision: 'ACCEPTED', notes: 'Teste de aceite.',
      },
    });
    expect(receipt.statusCode, receipt.body).toBe(200);
    expect(receipt.json()).toMatchObject({
      status: 'RECEIVED',
      receipt: {
        version: 1, inboundInvoiceNumber: 'NF-TESTE-1', documentWeightKg: '33000.000',
        arrivalWeightKg: '33000.000', consideredWeightKg: '33000.000',
        acceptedWeightKg: '33000.000', netWeightKg: '33000.000',
      },
    });
    const inventoryAfterReceipt = await server.inject({
      method: 'GET', url: '/v1/inventory', headers: identityHeaders,
    });
    expect(inventoryAfterReceipt.statusCode, inventoryAfterReceipt.body).toBe(200);
    expect(inventoryAfterReceipt.json()).toMatchObject({
      summary: {
        physicalWeightKg: '33000.000',
        availableWeightKg: '33000.000',
        lotCount: 1,
        pendingOwnershipCount: 1,
      },
      lots: [{ sourceLoadId: scheduledLoad.json().id, status: 'AVAILABLE', quantityKg: '33000.000' }],
      movements: [{ type: 'RECEIPT', quantityDeltaKg: '33000.000' }],
    });
    const corrected = await server.inject({
      method: 'PUT', url: `/v1/loads/${scheduledLoad.json().id}/receipt`, headers: identityHeaders,
      payload: {
        receivedAt: '2026-11-10T12:00:00-03:00', grossWeightKg: '48010.000', tareWeightKg: '15000.000',
        inboundInvoiceNumber: 'NF-TESTE-1', inboundInvoiceSeries: '1', inboundInvoiceAccessKey: null,
        documentWeightKg: '33000.000', consideredWeightKg: '33000.000', acceptedWeightKg: null,
        weightDecisionReason: 'Peso de chegada divergente mantido em revisão para decisão humana.',
        weighingMode: 'MANUAL_CONTINGENCY', scaleTicketNumber: null,
        contingencyReason: 'Correção manual após indisponibilidade da integração da balança.',
        moisturePct: '14.8', impurityPct: '2.4', damagedPct: '5.1', qualityDecision: 'REVIEW_REQUIRED', notes: null,
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json()).toMatchObject({
      status: 'IN_RECEIVING',
      receipt: { version: 2, arrivalWeightKg: '33010.000', consideredWeightKg: '33000.000', acceptedWeightKg: null },
    });
    const inventoryAfterReview = await server.inject({
      method: 'GET', url: '/v1/inventory', headers: identityHeaders,
    });
    expect(inventoryAfterReview.statusCode, inventoryAfterReview.body).toBe(200);
    expect(inventoryAfterReview.json()).toMatchObject({
      summary: { physicalWeightKg: '0.000', availableWeightKg: '0.000', lotCount: 1 },
      lots: [{ sourceLoadId: scheduledLoad.json().id, status: 'BLOCKED_REVIEW', quantityKg: '0.000' }],
    });
    expect(inventoryAfterReview.json().movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'RECEIPT', quantityDeltaKg: '33000.000' }),
      expect.objectContaining({ type: 'RECEIPT_REVERSAL', quantityDeltaKg: '-33000.000' }),
    ]));
    const detail = await server.inject({
      method: 'GET', url: `/v1/loads/${scheduledLoad.json().id}`, headers: identityHeaders,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ status: 'IN_RECEIVING', receipt: { version: 2, qualityDecision: 'REVIEW_REQUIRED' } });
    expect(detail.json().receiptHistory).toHaveLength(2);
    const contracts = await server.inject({ method: 'GET', url: '/v1/contracts', headers: identityHeaders });
    expect(contracts.statusCode).toBe(200);
    expect(contracts.json()).toMatchObject({
      tenant: { legalName: 'Tenant local', isDemo: false, demoSeedVersion: null },
      items: [{
        id: contract.contractId,
        counterparty_name: 'Cooperativa Teste do Cerrado',
        status: 'ACTIVE',
        load_count: 1,
        scheduled_weight_kg: '50000.000',
        available_weight_kg: '550000.000',
        pending_obligations: 2,
      }],
    });
    const overviewAfterContract = await server.inject({ method: 'GET',
      url: '/v1/overview?commodity=MILHO', headers: identityHeaders });
    expect(overviewAfterContract.statusCode).toBe(200);
    expect(overviewAfterContract.json()).toMatchObject({
      charts: { marginComponents: [{ contractId: contract.contractId, policyVersion: 2 }] },
      indicators: { purchaseContractedKg: '600000', pendingObligationCount: 2 },
    });
    const overflow = await server.inject({
      method: 'POST', url: `/v1/contracts/${contract.contractId}/loads`, headers: identityHeaders,
      payload: {
        scheduledLocal: '2026-11-11T08:30',
        expectedWeightKg: '550000.001',
        vehiclePlate: 'QAB-2J41',
        carrierName: 'Transmil',
        destinationCode: 'ARM-RV01',
      },
    });
    expect(overflow.statusCode).toBe(422);
    expect(overflow.json()).toMatchObject({ code: 'LOAD_EXCEEDS_CONTRACT_BALANCE' });

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
    expect(firstPass).toMatchObject({ claimed: 25, published: 25, failed: 0, recovered: 0, pending: 0 });
    expect(await processor.processTenant(identityHeaders['x-tenant-id'])).toMatchObject({
      claimed: 0, published: 0, failed: 0, recovered: 0, pending: 0,
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
    expect(activity.rows[0]?.count).toBe('25');
    expect(projection.rows[0]?.projected_margin_per_sc).toBe('3.000000');
    expect(projection.rows[0]?.obligations).toHaveLength(3);
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
    expect(failedPass).toMatchObject({ claimed: 1, published: 0, failed: 1, recovered: 0, pending: 1, delayed: 1 });
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

    await verification.query(
      `UPDATE app.outbox_events
          SET aggregate_id=$3, available_at=now()
        WHERE tenant_id=$1 AND id=$2`,
      [identityHeaders['x-tenant-id'], invalidEventId, contract.contractId],
    );
    const recoveredPass = await processor.processTenant(identityHeaders['x-tenant-id']);
    expect(recoveredPass).toMatchObject({
      claimed: 1, published: 1, failed: 0, recovered: 1, pending: 0, delayed: 0,
    });
    const recovered = await verification.query<{ attempts: number; published_at: Date | null; last_error: string | null }>(
      `SELECT attempts,published_at,last_error FROM app.outbox_events WHERE tenant_id=$1 AND id=$2`,
      [identityHeaders['x-tenant-id'], invalidEventId],
    );
    expect(recovered.rows[0]).toMatchObject({ attempts: 2, last_error: null });
    expect(recovered.rows[0]?.published_at).toBeInstanceOf(Date);

    const otherTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const otherEventId = randomUUID();
    await verification.query(
      `INSERT INTO app.tenants (id,legal_name,timezone)
       VALUES ($1,'Tenant isolado','America/Sao_Paulo')`,
      [otherTenantId],
    );
    await verification.query(
      `INSERT INTO app.outbox_events
         (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,'offer.created','offer',$3,'{}'::jsonb)`,
      [otherTenantId, otherEventId, randomUUID()],
    );
    expect(await processor.processTenant(identityHeaders['x-tenant-id'])).toMatchObject({ claimed: 0, pending: 0 });
    const isolated = await verification.query<{ published_at: Date | null }>(
      'SELECT published_at FROM app.outbox_events WHERE tenant_id=$1 AND id=$2',
      [otherTenantId, otherEventId],
    );
    expect(isolated.rows[0]?.published_at).toBeNull();
    expect(await processor.processTenant(otherTenantId)).toMatchObject({ claimed: 1, published: 1, failed: 0 });
    await verification.end();
  });

  it('keeps counterparty classification explicit and prices soybean independently', async () => {
    const server = app.getHttpAdapter().getInstance();
    const mismatch = await server.inject({
      method: 'POST', url: '/v1/counterparties', headers: identityHeaders,
      payload: { legalName: 'Produtor Pessoa Física', taxId: '12345678909', partyType: 'COOPERATIVE' },
    });
    expect(mismatch.statusCode).toBe(400);

    const person = await server.inject({
      method: 'POST', url: '/v1/counterparties', headers: identityHeaders,
      payload: { legalName: 'Produtor Pessoa Física', taxId: '12345678909', partyType: 'PERSON' },
    });
    expect(person.statusCode, person.body).toBe(201);
    expect(person.json()).toMatchObject({ partyType: 'PERSON', taxId: '12345678909' });

    const legacyId = '99999999-9999-4999-8999-999999999999';
    const verification = new Pool({ connectionString: databaseUrl });
    await verification.query(
      `INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id)
       VALUES ($1,$2,'Contraparte legada','99000000000999')`,
      [identityHeaders['x-tenant-id'], legacyId]);
    await verification.end();
    const before = await server.inject({ method: 'GET', url: '/v1/counterparties', headers: identityHeaders });
    expect(before.json()).toContainEqual(expect.objectContaining({ id: legacyId, partyType: 'UNCLASSIFIED' }));
    expect(before.json().find((item: { id: string }) => item.id === legacyId)).not.toHaveProperty('taxId');
    const blockedLegacySale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers: identityHeaders,
      payload: {
        counterpartyId: legacyId, reference: 'LEGACY-BLOCKED', commodity: 'SOJA',
        quantityKg: '6000.000', salePricePerKg: '2.500000', destinationCode: 'ARM_MT_01',
        deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30', requiredDocuments: [], paymentTermDays: 7,
      },
    });
    expect(blockedLegacySale.statusCode).toBe(422);
    expect(blockedLegacySale.json()).toMatchObject({ code: 'COUNTERPARTY_PROFILE_REQUIRED' });
    const classified = await server.inject({
      method: 'PATCH', url: `/v1/counterparties/${legacyId}/profile`, headers: identityHeaders,
      payload: { partyType: 'COMPANY' },
    });
    expect(classified.statusCode, classified.body).toBe(200);
    expect(classified.json().partyType).toBe('COMPANY');

    const missingPolicy = await server.inject({
      method: 'GET', url: '/v1/settings/margin-policy/SOJA', headers: identityHeaders,
    });
    expect(missingPolicy.json()).toBeNull();
    const policy = await server.inject({
      method: 'PATCH', url: '/v1/settings/margin-policy', headers: identityHeaders,
      payload: { commodity: 'SOJA', autoApprovalMarginPerSc: '6.00', absoluteFloorMarginPerSc: '2.00' },
    });
    expect(policy.statusCode, policy.body).toBe(200);
    expect(policy.json()).toMatchObject({ commodity: 'SOJA', version: 1 });
    const offer = await server.inject({
      method: 'POST', url: '/v1/offers', headers: identityHeaders,
      payload: {
        counterpartyId: person.json().id, commodity: 'SOJA', unit: 'SC_60KG', quantitySc: '1200',
        deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30', purchasePricePerSc: '100.00',
        saleReferencePerSc: '110.00', costs: [{ code: 'FREIGHT', amountPerSc: '3.00' }],
      },
    });
    expect(offer.statusCode, offer.body).toBe(201);
    expect(offer.json().pricing.projectedMarginPerSc).toBe('7.00');
    const submitted = await server.inject({
      method: 'POST', url: `/v1/offers/${offer.json().offerId}/submit`, headers: identityHeaders,
    });
    expect(submitted.json()).toMatchObject({ status: 'APPROVED', decision: 'AUTO_APPROVED' });
    const activated = await server.inject({
      method: 'POST', url: `/v1/offers/${offer.json().offerId}/activate-contract`, headers: identityHeaders,
    });
    expect(activated.statusCode, activated.body).toBe(201);
    const summary = await server.inject({
      method: 'GET', url: `/v1/contracts/${activated.json().contractId}/summary`, headers: identityHeaders,
    });
    expect(summary.json()).toMatchObject({ commodity: 'SOJA', projected_margin_per_sc: '7.000000' });

    const sale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers: identityHeaders,
      payload: {
        counterpartyId: legacyId, reference: 'SOJA-TESTE-001', commodity: 'SOJA',
        quantityKg: '6000.000', salePricePerKg: '2.500000', destinationCode: 'ARM_MT_01',
        deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30', requiredDocuments: [],
        paymentTermDays: 7,
      },
    });
    expect(sale.statusCode, sale.body).toBe(201);
    expect(sale.json()).toMatchObject({ commodity: 'SOJA' });
  });
});
