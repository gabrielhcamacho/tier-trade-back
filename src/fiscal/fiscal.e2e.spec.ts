import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Decimal from 'decimal.js';
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

  it('loads the persisted demo document and draft fiscal configuration', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET', url: '/v1/fiscal', headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      tenant: { isDemo: true, demoSeedVersion: 12 },
      summary: { received: 1, validated: 0, rejected: 0, linkedTitles: 0 },
      documents: [{
        id: documentId, contractReference: 'CV-2026-0042', documentNumber: 'NFE-DEMO-0001',
        totalAmount: '11360.00', expectedAmount: '11360.00', differenceAmount: '0.00', status: 'RECEIVED',
      }],
      establishments: [{ uf: 'GO', taxRegime: null }],
      configurations: [{ version: 1, status: 'DRAFT', cfop: null,
        roundingMode: null, roundingScale: null, taxComponents: [] }],
      calculations: [],
      authorities: [{ legalName: 'Autoridade fiscal estadual — Dado fictício', jurisdiction: 'STATE', uf: 'GO' }],
      obligations: [],
      taxCalculation: { status: 'BLOCKED_CONFIGURATION', activeConfigurationCount: 0 },
    });
  });

  it('activates only an explicit complete version and then creates a new draft version', async () => {
    const server = app.getHttpAdapter().getInstance();
    const updatedDemoEstablishment = await server.inject({
      method: 'PATCH', url: '/v1/fiscal/establishments/e5000000-0000-4000-8000-000000000001', headers,
      payload: {
        legalName: 'Cerrado Trading — Estabelecimento fictício', taxId: '99000000000199',
        stateRegistration: 'ISENTO', uf: 'GO', taxRegime: 'LUCRO_REAL',
      },
    });
    expect(updatedDemoEstablishment.statusCode, updatedDemoEstablishment.body).toBe(200);
    const establishment = await server.inject({
      method: 'POST', url: '/v1/fiscal/establishments', headers,
      payload: {
        legalName: 'Estabelecimento fiscal de teste', taxId: '99000000000991',
        stateRegistration: 'ISENTO', uf: 'GO', taxRegime: 'LUCRO_REAL',
      },
    });
    expect(establishment.statusCode, establishment.body).toBe(201);
    const establishmentId = establishment.json().id as string;

    const configuration = await server.inject({
      method: 'POST', url: '/v1/fiscal/configurations', headers,
      payload: {
        establishmentId, name: 'Regra homologada no teste', commodity: 'MILHO', destinationUf: 'SP',
        cfop: '6102', emissionStrategy: 'INTEGRATED', technicalResponsible: 'Responsável de teste',
        effectiveFrom: '2026-10-01', effectiveTo: null,
        roundingMode: 'HALF_UP', roundingScale: 2,
        taxComponents: [
          { tax: 'ICMS', treatment: 'TAXED', basis: 'DOCUMENT_TOTAL', ratePct: '7.000000', retained: true },
          { tax: 'PIS', treatment: 'SUSPENDED', basis: 'DOCUMENT_TOTAL', ratePct: null, retained: false },
        ],
      },
    });
    expect(configuration.statusCode, configuration.body).toBe(201);
    const configurationId = configuration.json().id as string;

    const activated = await server.inject({
      method: 'POST', url: `/v1/fiscal/configurations/${configurationId}/activate`, headers,
    });
    expect(activated.statusCode, activated.body).toBe(201);
    expect(activated.json()).toMatchObject({ status: 'ACTIVE' });

    const workspace = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    const body = workspace.json();
    expect(body).toMatchObject({
      taxCalculation: { status: 'READY', activeConfigurationCount: 1 },
    });
    expect(body.configurations.find((item: { id: string }) => item.id === configurationId)).toMatchObject({
      id: configurationId, status: 'ACTIVE', version: 1, cfop: '6102',
      roundingMode: 'HALF_UP', roundingScale: 2,
      taxComponents: [{ tax: 'ICMS', treatment: 'TAXED', basis: 'DOCUMENT_TOTAL', ratePct: '7.000000', retained: true },
        { tax: 'PIS', treatment: 'SUSPENDED', basis: 'DOCUMENT_TOTAL', ratePct: null, retained: false }],
    });

    const calculationPayload = {
      requestKey: 'e7000000-0000-4000-8000-000000000001', establishmentId,
      operationType: 'SALE_DISPATCH', commodity: 'milho', destinationUf: 'SP',
      occurredOn: '2026-10-02', grossAmount: '45000.00', currency: 'BRL',
      sourceType: 'MANUAL', sourceId: null,
    };
    const calculation = await server.inject({
      method: 'POST', url: '/v1/fiscal/calculations', headers, payload: calculationPayload,
    });
    expect(calculation.statusCode, calculation.body).toBe(201);
    expect(calculation.json()).toMatchObject({
      requestKey: calculationPayload.requestKey,
      configuration: { id: configurationId, version: 1 },
      result: {
        grossAmount: '45000', taxTotal: '3150.00', retainedTotal: '3150.00', netAmount: '41850.00',
        rounding: { mode: 'HALF_UP', scale: 2 },
        components: [
          { tax: 'ICMS', taxableBase: '45000', ratePct: '7.000000', amount: '3150.00' },
          { tax: 'PIS', amount: '0.00' },
        ],
      },
    });
    const repeated = await server.inject({
      method: 'POST', url: '/v1/fiscal/calculations', headers, payload: calculationPayload,
    });
    expect(repeated.statusCode, repeated.body).toBe(201);
    expect(repeated.json().id).toBe(calculation.json().id);
    const conflicting = await server.inject({
      method: 'POST', url: '/v1/fiscal/calculations', headers,
      payload: { ...calculationPayload, grossAmount: '46000.00' },
    });
    expect(conflicting.statusCode).toBe(409);
    expect(conflicting.json()).toMatchObject({ code: 'FISCAL_CALCULATION_IDEMPOTENCY_CONFLICT' });
    const notApplicable = await server.inject({
      method: 'POST', url: '/v1/fiscal/calculations', headers,
      payload: { ...calculationPayload, requestKey: 'e7000000-0000-4000-8000-000000000002', destinationUf: 'MG' },
    });
    expect(notApplicable.statusCode).toBe(422);
    expect(notApplicable.json()).toMatchObject({ code: 'FISCAL_CONFIGURATION_NOT_APPLICABLE' });

    const calculatedWorkspace = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(calculatedWorkspace.json().calculations).toMatchObject([{
      id: calculation.json().id, configuration: { version: 1 },
      taxTotal: '3150.000000', retainedTotal: '3150.000000', netAmount: '41850.000000',
    }]);

    const acceptancePayload = {
      requestKey: 'e7000000-0000-4000-8000-000000000010',
      obligations: [{
        tax: 'ICMS', authorityId: 'e8000000-0000-4000-8000-000000000001',
        competenceDate: '2026-10-02', dueDate: '2026-10-12', titleEffect: 'NONE',
        paymentResponsibility: 'TENANT', titleNumber: 'TF-ICMS-0001',
        documentReference: 'CALCULO-45000',
      }],
    };
    const accepted = await server.inject({
      method: 'POST', url: `/v1/fiscal/calculations/${calculation.json().id}/accept`,
      headers, payload: acceptancePayload,
    });
    expect(accepted.statusCode, accepted.body).toBe(201);
    expect(accepted.json()).toMatchObject({ status: 'ACCEPTED', idempotent: false });
    const acceptedAgain = await server.inject({
      method: 'POST', url: `/v1/fiscal/calculations/${calculation.json().id}/accept`,
      headers, payload: acceptancePayload,
    });
    expect(acceptedAgain.statusCode, acceptedAgain.body).toBe(201);
    expect(acceptedAgain.json()).toMatchObject({ status: 'ACCEPTED', idempotent: true });

    const linkedCalculation = await server.inject({
      method: 'POST', url: '/v1/fiscal/calculations', headers,
      payload: {
        ...calculationPayload, requestKey: 'e7000000-0000-4000-8000-000000000003',
        grossAmount: '11360.00', sourceType: 'FINANCIAL_EVENT',
        sourceId: 'e0000000-0000-4000-8000-000000000001',
      },
    });
    expect(linkedCalculation.statusCode, linkedCalculation.body).toBe(201);
    expect(linkedCalculation.json()).toMatchObject({
      result: { taxTotal: '795.20', retainedTotal: '795.20', netAmount: '10564.80' },
    });
    const acceptedLinked = await server.inject({
      method: 'POST', url: `/v1/fiscal/calculations/${linkedCalculation.json().id}/accept`, headers,
      payload: {
        requestKey: 'e7000000-0000-4000-8000-000000000011',
        obligations: [{
          tax: 'ICMS', authorityId: 'e8000000-0000-4000-8000-000000000001',
          competenceDate: '2026-10-02', dueDate: '2026-10-12',
          titleEffect: 'REDUCE_SOURCE_TITLE', paymentResponsibility: 'TENANT',
          titleNumber: 'TF-ICMS-0002', documentReference: 'NFE-DEMO-0001',
        }],
      },
    });
    expect(acceptedLinked.statusCode, acceptedLinked.body).toBe(201);

    const obligationsWorkspace = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(obligationsWorkspace.json()).toMatchObject({
      summary: { openObligations: 2, taxPayables: 2 },
      obligations: expect.arrayContaining([
        expect.objectContaining({ tax: 'ICMS', amount: '3150.000000',
          payable: expect.objectContaining({ titleNumber: 'TF-ICMS-0001' }) }),
        expect.objectContaining({ tax: 'ICMS', amount: '795.200000',
          payable: expect.objectContaining({ titleNumber: 'TF-ICMS-0002' }),
          titleAdjustment: expect.objectContaining({ titleId: expect.any(String) }) }),
      ]),
    });
    const financeWorkspace = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    expect(financeWorkspace.json()).toMatchObject({
      summary: { receivableAmount: '6564.80', payableAmount: '3945.20' },
    });
    const fiscalPayable = financeWorkspace.json().events.find(
      (event: { title: { number: string } | null }) => event.title?.number === 'TF-ICMS-0001',
    );
    const partialPayment = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${fiscalPayable.title.id}/payments`, headers,
      payload: {
        amount: '1000.00', paidAt: '2026-10-03T14:00:00-03:00',
        bankReference: 'PAG-FISCAL-ICMS-01', notes: 'Pagamento parcial da obrigação fiscal.',
      },
    });
    expect(partialPayment.statusCode, partialPayment.body).toBe(201);
    expect(partialPayment.json()).toMatchObject({
      status: 'PARTIALLY_SETTLED', outstandingAmount: '2150.00',
    });
    const overflowPayment = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${fiscalPayable.title.id}/payments`, headers,
      payload: {
        amount: '2150.01', paidAt: '2026-10-03T14:30:00-03:00',
        bankReference: 'PAG-FISCAL-ICMS-OVERFLOW', notes: null,
      },
    });
    expect(overflowPayment.statusCode).toBe(422);
    expect(overflowPayment.json()).toMatchObject({ code: 'PAYMENT_EXCEEDS_TITLE_BALANCE' });
    const finalPayment = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${fiscalPayable.title.id}/payments`, headers,
      payload: {
        amount: '2150.00', paidAt: '2026-10-03T15:00:00-03:00',
        bankReference: 'PAG-FISCAL-ICMS-02', notes: 'Liquidação integral da obrigação fiscal.',
      },
    });
    expect(finalPayment.statusCode, finalPayment.body).toBe(201);
    expect(finalPayment.json()).toMatchObject({ status: 'SETTLED', outstandingAmount: '0.00' });
    const paidWorkspace = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    expect(paidWorkspace.json()).toMatchObject({
      summary: { paidAmount: '3150.00', payableAmount: '795.20', netCashFlowAmount: '850.00' },
      payments: expect.arrayContaining([
        expect.objectContaining({ titleNumber: 'TF-ICMS-0001', amount: '1000.00', reversedAt: null }),
        expect.objectContaining({ titleNumber: 'TF-ICMS-0001', amount: '2150.00', reversedAt: null }),
      ]),
    });
    const settledObligation = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(settledObligation.json().obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: '3150.000000', status: 'SETTLED', payable: expect.objectContaining({
        paidAmount: '3150.00', outstandingAmount: '0.00', status: 'SETTLED',
      }) }),
    ]));
    const paymentReversal = await server.inject({
      method: 'POST', url: `/v1/finance/payments/${finalPayment.json().id}/reverse`, headers,
      payload: { reason: 'Estorno controlado do segundo pagamento fiscal.' },
    });
    expect(paymentReversal.statusCode, paymentReversal.body).toBe(201);
    expect(paymentReversal.json()).toMatchObject({ status: 'PARTIALLY_SETTLED', reversed: true });
    const reversedWorkspace = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    expect(reversedWorkspace.json()).toMatchObject({
      summary: { paidAmount: '1000.00', payableAmount: '2945.20', netCashFlowAmount: '3000.00' },
    });
    const settleAdjustedTitle = await server.inject({
      method: 'POST', url: '/v1/finance/titles/e1000000-0000-4000-8000-000000000001/settlements', headers,
      payload: {
        amount: '6564.80', receivedAt: '2026-10-02T18:00:00-03:00',
        bankReference: 'FISCAL-NET-BALANCE-TEST', notes: 'Liquidação do saldo após retenção.',
      },
    });
    expect(settleAdjustedTitle.statusCode, settleAdjustedTitle.body).toBe(201);
    expect(settleAdjustedTitle.json()).toMatchObject({ status: 'SETTLED', outstandingAmount: '0.00' });

    const version = await server.inject({
      method: 'POST', url: `/v1/fiscal/configurations/${configurationId}/new-version`, headers,
    });
    expect(version.statusCode, version.body).toBe(201);
    expect(version.json()).toMatchObject({ version: 2, status: 'DRAFT' });
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

  it('links an accepted purchase receipt to inbound NF-e, payable, payment and reversal', async () => {
    const server = app.getHttpAdapter().getInstance();
    const initial = await server.inject({ method: 'GET', url: '/v1/fiscal', headers });
    expect(initial.statusCode, initial.body).toBe(200);
    const receipt = initial.json().eligiblePurchaseReceipts[0] as {
      id: string; acceptedWeightKg: string; purchasePricePerSc: string;
    };
    expect(receipt).toBeTruthy();
    const raw = new Decimal(receipt.acceptedWeightKg).div(60).times(receipt.purchasePricePerSc);
    expect(raw.decimalPlaces()).toBeLessThanOrEqual(2);
    const totalAmount = raw.toFixed(2);
    const created = await server.inject({
      method: 'POST', url: '/v1/fiscal/purchase-documents', headers,
      payload: {
        loadReceiptId: receipt.id, documentNumber: 'NF-COMPRA-E2E',
        accessKey: '51000000000000000000000000000000000000000002',
        issuedAt: '2026-10-02T10:00:00-03:00', totalAmount,
        dueDate: '2026-10-20', titleNumber: 'CP-E2E-0001',
        validationNotes: 'Conferência integrada de compra, peso e financeiro.',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({ status: 'RECEIVED', expectedAmount: totalAmount });
    const rejected = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${created.json().id}/reject`, headers,
      payload: { reason: 'Número fiscal incorreto; corrigir e reconferir.' },
    });
    expect(rejected.statusCode, rejected.body).toBe(201);
    const corrected = await server.inject({
      method: 'PATCH', url: `/v1/fiscal/documents/${created.json().id}`, headers,
      payload: {
        documentNumber: 'NF-COMPRA-E2E-CORRIGIDA',
        accessKey: '51000000000000000000000000000000000000000002',
        issuedAt: '2026-10-02T10:00:00-03:00', totalAmount,
        validationNotes: 'Documento de compra corrigido sem perder o vínculo operacional.',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json()).toMatchObject({ status: 'RECEIVED' });
    const validated = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${created.json().id}/validate`, headers,
    });
    expect(validated.statusCode, validated.body).toBe(201);
    expect(validated.json()).toMatchObject({ status: 'VALIDATED', linkedTitleId: expect.any(String) });
    const titleId = validated.json().linkedTitleId as string;
    const paid = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${titleId}/payments`, headers,
      payload: { amount: '10.00', paidAt: '2026-10-03T10:00:00-03:00',
        bankReference: 'PIX-COMPRA-E2E', notes: 'Pagamento parcial integrado.' },
    });
    expect(paid.statusCode, paid.body).toBe(201);
    expect(paid.json()).toMatchObject({ purchaseReceiptId: receipt.id, status: 'PARTIALLY_SETTLED' });
    const reversed = await server.inject({
      method: 'POST', url: `/v1/finance/payments/${paid.json().id}/reverse`, headers,
      payload: { reason: 'Estorno controlado do pagamento de teste.' },
    });
    expect(reversed.statusCode, reversed.body).toBe(201);
    expect(reversed.json()).toMatchObject({ purchaseReceiptId: receipt.id, status: 'OPEN', reversed: true });
    const financeBefore = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    const purchaseEvent = financeBefore.json().events.find((event: { loadReceiptId: string }) =>
      event.loadReceiptId === receipt.id) as { id: string; title: { outstandingAmount: string } };
    const component = await server.inject({
      method: 'POST', url: '/v1/finance/purchase-cost-components', headers,
      payload: { financialEventId: purchaseEvent.id, componentType: 'QUALITY_DISCOUNT',
        payableImpact: 'REDUCE_PAYABLE', amount: '5.00',
        description: 'Desconto documentado no laudo de qualidade.', externalReference: 'LAUDO-E2E-01' },
    });
    expect(component.statusCode, component.body).toBe(201);
    const policy = await server.inject({ method: 'POST', url: '/v1/finance/policies', headers,
      payload: { paymentApprovalThreshold: '100.00' } });
    expect(policy.statusCode, policy.body).toBe(201);
    const batch = await server.inject({ method: 'POST', url: '/v1/finance/payment-batches', headers,
      payload: { reference: 'LOTE-E2E-01', scheduledOn: '2026-10-21',
        items: [{ titleId, amount: '10.00' }] } });
    expect(batch.statusCode, batch.body).toBe(201);
    const submitted = await server.inject({ method: 'POST',
      url: `/v1/finance/payment-batches/${batch.json().id}/submit`, headers });
    expect(submitted.json()).toMatchObject({ status: 'APPROVED', requiresApproval: false });
    const executed = await server.inject({ method: 'POST',
      url: `/v1/finance/payment-batches/${batch.json().id}/execute`, headers });
    expect(executed.json()).toMatchObject({ status: 'EXECUTED', paymentCount: 1 });
    const account = await server.inject({ method: 'POST', url: '/v1/finance/bank-accounts', headers,
      payload: { code: 'BB01', name: 'Conta operacional E2E' } });
    expect(account.statusCode, account.body).toBe(201);
    const entry = await server.inject({ method: 'POST', url: '/v1/finance/bank-statement-entries', headers,
      payload: { bankAccountId: account.json().id, occurredAt: '2026-10-21T10:00:00-03:00',
        direction: 'DEBIT', amount: '10.00', bankReference: 'EXTRATO-E2E-01',
        description: 'Pagamento do lote E2E.' } });
    expect(entry.statusCode, entry.body).toBe(201);
    const afterBatch = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    const executedBatch = afterBatch.json().governance.paymentBatches.find((item: { id: string }) =>
      item.id === batch.json().id) as { items: Array<{ paymentId: string }> };
    const reconciliation = await server.inject({ method: 'POST',
      url: `/v1/finance/bank-statement-entries/${entry.json().id}/reconcile`, headers,
      payload: { matchedType: 'PAYMENT', matchedId: executedBatch.items[0]!.paymentId } });
    expect(reconciliation.statusCode, reconciliation.body).toBe(201);
    expect(reconciliation.json()).toMatchObject({ status: 'MATCHED' });
    const governed = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    expect(governed.json()).toMatchObject({ governance: {
      activePolicy: { payment_approval_threshold: '100.00' },
      purchaseCostComponents: [{ component_type: 'QUALITY_DISCOUNT', amount: '5.00' }],
      paymentBatches: [{ status: 'EXECUTED' }],
      bankStatementEntries: [{ status: 'MATCHED' }],
    } });
    const overview = await server.inject({ method: 'GET', url: '/v1/overview', headers });
    expect(overview.statusCode, overview.body).toBe(200);
    expect(overview.json()).toMatchObject({
      indicators: { purchasePayableOpenCount: 1 },
      operational: { purchasePayablesOpen: 1 },
    });
  });

  it('homologates the complete soybean purchase, adjustment, sale and partial receipt scenario', async () => {
    const server = app.getHttpAdapter().getInstance();
    const policy = await server.inject({
      method: 'PATCH', url: '/v1/settings/margin-policy', headers,
      payload: { commodity: 'SOJA', autoApprovalMarginPerSc: '6.00', absoluteFloorMarginPerSc: '2.00' },
    });
    expect(policy.statusCode, policy.body).toBe(200);
    const offer = await server.inject({
      method: 'POST', url: '/v1/offers', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000001', commodity: 'SOJA', unit: 'SC_60KG',
        quantitySc: '1000', deliveryStart: '2026-11-01', deliveryEnd: '2026-11-30',
        purchasePricePerSc: '100.00', saleReferencePerSc: '112.00',
        costs: [{ code: 'FREIGHT', amountPerSc: '4.00' }],
      },
    });
    expect(offer.statusCode, offer.body).toBe(201);
    const submitted = await server.inject({
      method: 'POST', url: `/v1/offers/${offer.json().offerId}/submit`, headers,
    });
    expect(submitted.json()).toMatchObject({ decision: 'AUTO_APPROVED', status: 'APPROVED' });
    const contract = await server.inject({
      method: 'POST', url: `/v1/offers/${offer.json().offerId}/activate-contract`, headers,
    });
    expect(contract.statusCode, contract.body).toBe(201);
    const load = await server.inject({
      method: 'POST', url: `/v1/contracts/${contract.json().contractId}/loads`, headers,
      payload: {
        scheduledLocal: '2026-11-10T08:30', expectedWeightKg: '12000.000',
        vehiclePlate: 'SOJ-1A23', carrierName: 'Transportadora cenário JD', destinationCode: 'ARM-MT01',
      },
    });
    expect(load.statusCode, load.body).toBe(201);
    const started = await server.inject({
      method: 'POST', url: `/v1/loads/${load.json().id}/start-receiving`, headers,
    });
    expect(started.statusCode, started.body).toBe(201);
    const occurrence = await server.inject({
      method: 'POST', url: `/v1/loads/${load.json().id}/occurrences`, headers,
      payload: {
        category: 'QUALITY', severity: 'WARNING', title: 'Contraprova do peso aceito',
        description: 'Cenário técnico JD-02: ocorrência registrada antes da correção versionada.',
        occurredAt: '2026-11-10T09:10:00-03:00',
      },
    });
    expect(occurrence.statusCode, occurrence.body).toBe(201);
    const baseReceipt = {
      receivedAt: '2026-11-10T09:20:00-03:00', inboundInvoiceNumber: 'NF-JD-SOJA-001',
      inboundInvoiceSeries: '1', inboundInvoiceAccessKey: '51261112345678000190550010000001231000001234',
      documentWeightKg: '12000.000', grossWeightKg: '27000.000', tareWeightKg: '15000.000',
      consideredWeightKg: '12000.000', acceptedWeightKg: '12000.000', weightDecisionReason: null,
      weighingMode: 'SCALE', scaleTicketNumber: 'BAL-JD-SOJA-001', contingencyReason: null,
      moisturePct: '13.5000', impurityPct: '1.0000', damagedPct: '2.0000',
      qualityDecision: 'ACCEPTED', notes: 'Cenário técnico de soja com valores explícitos, não homologados.',
    };
    const receipt = await server.inject({
      method: 'PUT', url: `/v1/loads/${load.json().id}/receipt`, headers, payload: baseReceipt,
    });
    expect(receipt.statusCode, receipt.body).toBe(200);
    const firstReport = await server.inject({
      method: 'POST', url: `/v1/loads/${load.json().id}/romaneio`, headers,
    });
    expect(firstReport.json()).toMatchObject({ version: 1, acceptedWeightKg: '12000.000' });
    const corrected = await server.inject({
      method: 'PUT', url: `/v1/loads/${load.json().id}/receipt`, headers,
      payload: { ...baseReceipt, consideredWeightKg: '11940.000', acceptedWeightKg: '11940.000',
        weightDecisionReason: 'Contraprova técnica reduziu sessenta quilos do peso aceito.' },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    const secondReport = await server.inject({
      method: 'POST', url: `/v1/loads/${load.json().id}/romaneio`, headers,
    });
    expect(secondReport.json()).toMatchObject({ version: 2, acceptedWeightKg: '11940.000' });
    const resolved = await server.inject({
      method: 'POST', url: `/v1/loads/${load.json().id}/occurrences/${occurrence.json().id}/resolve`, headers,
      payload: { resolution: 'Contraprova registrada na segunda versão do recebimento e do romaneio.' },
    });
    expect(resolved.json()).toMatchObject({ status: 'RESOLVED' });

    const purchase = await server.inject({
      method: 'POST', url: '/v1/fiscal/purchase-documents', headers,
      payload: {
        loadReceiptId: corrected.json().receipt.id, documentNumber: 'NF-JD-SOJA-001',
        accessKey: '51261112345678000190550010000001231000001234', issuedAt: '2026-11-10T09:30:00-03:00',
        totalAmount: '19900.00', dueDate: '2026-11-20', titleNumber: 'CP-JD-SOJA-001',
        validationNotes: 'Valor conferido contra 199 sacas aceitas a R$ 100,00.',
      },
    });
    expect(purchase.statusCode, purchase.body).toBe(201);
    const validatedPurchase = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${purchase.json().id}/validate`, headers,
    });
    expect(validatedPurchase.json()).toMatchObject({ status: 'VALIDATED', linkedTitleId: expect.any(String) });
    const finance = await server.inject({ method: 'GET', url: '/v1/finance', headers });
    const purchaseEvent = finance.json().events.find((event: { loadReceiptId: string }) =>
      event.loadReceiptId === corrected.json().receipt.id) as { id: string };
    const discount = await server.inject({
      method: 'POST', url: '/v1/finance/purchase-cost-components', headers,
      payload: {
        financialEventId: purchaseEvent.id, componentType: 'QUALITY_DISCOUNT', payableImpact: 'REDUCE_PAYABLE',
        amount: '100.00', description: 'Valor explícito para exercitar o ajuste; sujeito à homologação da JD.',
        externalReference: 'CONTRAPROVA-JD-SOJA-001',
      },
    });
    expect(discount.statusCode, discount.body).toBe(201);

    const inventory = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    const soyLot = inventory.json().lots.find((lot: { commodity: string; sourceLoadId: string }) =>
      lot.commodity === 'SOJA' && lot.sourceLoadId === load.json().id) as { id: string };
    expect(soyLot).toBeTruthy();
    const sale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', reference: 'CV-JD-SOJA-001',
        commodity: 'SOJA', quantityKg: '6000.000', salePricePerKg: '3.000000', destinationCode: 'IND-MT01',
        deliveryStart: '2026-11-10', deliveryEnd: '2026-11-30', requiredDocuments: ['Nota fiscal'],
        paymentTermDays: 7,
      },
    });
    expect(sale.statusCode, sale.body).toBe(201);
    const allocation = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: soyLot.id, quantityKg: '6000.000' },
    });
    const dispatch = await server.inject({
      method: 'POST', url: '/v1/inventory/dispatches', headers,
      payload: {
        allocationId: allocation.json().id, quantityKg: '2000.000', dispatchedAt: '2026-11-12T10:00:00-03:00',
        vehiclePlate: 'VEN-4D56', documentReference: 'NFV-JD-SOJA-001', notes: 'Expedição parcial JD-03.',
      },
    });
    expect(dispatch.statusCode, dispatch.body).toBe(201);
    const saleTitle = await server.inject({
      method: 'POST', url: '/v1/finance/titles', headers,
      payload: {
        financialEventId: dispatch.json().financialEventId, titleNumber: 'TR-JD-SOJA-001',
        documentReference: 'NFV-JD-SOJA-001', dueDate: '2026-11-19',
      },
    });
    expect(saleTitle.json()).toMatchObject({ amount: '6000.00', status: 'OPEN' });
    const outbound = await server.inject({
      method: 'POST', url: '/v1/fiscal/documents', headers,
      payload: {
        financialEventId: dispatch.json().financialEventId, documentNumber: 'NFV-JD-SOJA-001',
        accessKey: '51261112345678000190550010000001231000005678', issuedAt: '2026-11-12T10:05:00-03:00',
        totalAmount: '6000.00', validationNotes: 'NF-e de saída do cenário técnico JD-03.',
      },
    });
    expect(outbound.statusCode, outbound.body).toBe(201);
    const validatedOutbound = await server.inject({
      method: 'POST', url: `/v1/fiscal/documents/${outbound.json().id}/validate`, headers,
    });
    expect(validatedOutbound.json()).toMatchObject({ status: 'VALIDATED', linkedTitleId: saleTitle.json().id });
    const partial = await server.inject({
      method: 'POST', url: `/v1/finance/titles/${saleTitle.json().id}/settlements`, headers,
      payload: {
        amount: '2000.00', receivedAt: '2026-11-19T10:00:00-03:00', bankReference: 'PIX-JD-SOJA-001',
        notes: 'Recebimento parcial do cenário técnico JD-04.',
      },
    });
    expect(partial.json()).toMatchObject({ status: 'PARTIALLY_SETTLED', outstandingAmount: '4000.00' });
    const account = await server.inject({
      method: 'POST', url: '/v1/finance/bank-accounts', headers,
      payload: { code: 'JD01', name: 'Conta técnica do cenário JD' },
    });
    const statement = await server.inject({
      method: 'POST', url: '/v1/finance/bank-statement-entries', headers,
      payload: {
        bankAccountId: account.json().id, occurredAt: '2026-11-19T10:01:00-03:00', direction: 'CREDIT',
        amount: '2000.00', bankReference: 'EXT-JD-SOJA-001', description: 'Crédito parcial para conciliação.',
      },
    });
    const reconciled = await server.inject({
      method: 'POST', url: `/v1/finance/bank-statement-entries/${statement.json().id}/reconcile`, headers,
      payload: { matchedType: 'SETTLEMENT', matchedId: partial.json().id },
    });
    expect(reconciled.json()).toMatchObject({ status: 'MATCHED' });
  });
});
