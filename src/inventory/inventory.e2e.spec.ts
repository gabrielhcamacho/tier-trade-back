import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { resetDemoTenant } from '../demo/demo-seed.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const headers = { 'x-tenant-id': tenantId, 'x-actor-id': actorId };

describe.runIf(Boolean(databaseUrl))('sales fulfillment and inventory ledger', () => {
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
      '20261008011332_bank_statement_import_batches.sql',
      '20261009165000_dispatch_destination_receipts.sql',
      '20261010002022_dispatch_delivery_requirements.sql',
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

  it('creates a sale, reserves an available lot and dispatches it partially', async () => {
    const server = app.getHttpAdapter().getInstance();
    const initial = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    expect(initial.statusCode, initial.body).toBe(200);
    expect(initial.json()).toMatchObject({
      summary: { physicalWeightKg: '24920.000', committedWeightKg: '12000.000', availableWeightKg: '12920.000' },
      salesContracts: [{ reference: 'CV-2026-0042', allocated_kg: '20000.000', dispatched_kg: '8000.000' }],
      allocations: [{ quantity_kg: '20000.000', dispatched_kg: '8000.000', status: 'ACTIVE' }],
      dispatches: [{ quantity_kg: '8000.000', document_reference: 'NF-DEMO-0001' }],
      economicReconciliations: [{
        dispatch_id: 'de000000-0000-4000-8000-000000000001',
        source_load_id: 'd7000000-0000-4000-8000-000000000001',
        sales_contract_reference: 'CV-2026-0042', revenue_amount: '11360.00',
        fiscal_document_number: 'NFE-DEMO-0001', fiscal_document_status: 'RECEIVED',
        title_number: 'TR-2026-0001', title_status: 'PARTIALLY_SETTLED',
        settled_amount: '4000.00', outstanding_amount: '7360.00',
      }],
    });

    const sale = await server.inject({
      method: 'POST', url: '/v1/inventory/sales-contracts', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', reference: 'CV-2026-0043',
        commodity: 'MILHO', quantityKg: '10000.000', salePricePerKg: '1.500000',
        destinationCode: 'IND_PR_01', deliveryStart: '2026-10-05', deliveryEnd: '2026-10-31',
        requiredDocuments: ['Nota fiscal'],
      },
    });
    expect(sale.statusCode, sale.body).toBe(201);

    const salesPortfolio = await server.inject({ method: 'GET', url: '/v1/inventory/sales-contracts', headers });
    expect(salesPortfolio.statusCode, salesPortfolio.body).toBe(200);
    expect(salesPortfolio.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sale.json().id, reference: 'CV-2026-0043', commodity: 'MILHO', status: 'DRAFT' }),
    ]));
    expect(salesPortfolio.json().counterparties).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'd1000000-0000-4000-8000-000000000005' }),
    ]));

    const firstVersion = await server.inject({
      method: 'GET', url: `/v1/inventory/sales-contracts/${sale.json().id}/versions`, headers,
    });
    expect(firstVersion.statusCode, firstVersion.body).toBe(200);
    expect(firstVersion.json().versions).toMatchObject([
      { version_number: 1, terms: { reference: 'CV-2026-0043', salePricePerKg: '1.500000' } },
    ]);

    const amended = await server.inject({
      method: 'PUT', url: `/v1/inventory/sales-contracts/${sale.json().id}`, headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', reference: 'CV-2026-0043',
        commodity: 'MILHO', quantityKg: '10000.000', salePricePerKg: '1.600000',
        destinationCode: 'IND_PR_01', deliveryStart: '2026-10-05', deliveryEnd: '2026-10-31',
        requiredDocuments: ['Nota fiscal'],
      },
    });
    expect(amended.statusCode, amended.body).toBe(200);
    const history = await server.inject({
      method: 'GET', url: `/v1/inventory/sales-contracts/${sale.json().id}/versions`, headers,
    });
    expect(history.json().versions).toMatchObject([
      { version_number: 2, terms: { salePricePerKg: '1.600000' } },
      { version_number: 1, terms: { salePricePerKg: '1.500000' } },
    ]);
    const unknownHistory = await server.inject({
      method: 'GET', url: '/v1/inventory/sales-contracts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/versions', headers,
    });
    expect(unknownHistory.statusCode).toBe(404);

    const inactiveAllocation = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: initial.json().lots[0].id, quantityKg: '10000.000' },
    });
    expect(inactiveAllocation.statusCode).toBe(409);

    const awaitingSignature = await server.inject({
      method: 'POST', url: `/v1/inventory/sales-contracts/${sale.json().id}/transition`, headers,
      payload: { status: 'AWAITING_SIGNATURE', reason: null },
    });
    expect(awaitingSignature.statusCode, awaitingSignature.body).toBe(201);
    const signedDocumentId = randomUUID();
    const signatureId = randomUUID();
    const evidenceSetup = new Pool({ connectionString: databaseUrl });
    await evidenceSetup.query(
      `INSERT INTO app.documents
        (tenant_id,id,aggregate_type,aggregate_id,document_type,file_name,mime_type,size_bytes,
         storage_path,status,uploaded_at,created_by,sales_contract_version_number)
       VALUES ($1,$2,'SALES_CONTRACT',$3,'SIGNED_CONTRACT','venda-assinada.pdf','application/pdf',100,
               $4,'AVAILABLE',now(),$5,3)`,
      [tenantId, signedDocumentId, sale.json().id, `test/${signedDocumentId}`, actorId],
    );
    await evidenceSetup.query(
      `INSERT INTO app.document_signatures
        (tenant_id,id,document_id,provider,signer_name,signer_role,status,signed_at,created_by)
       VALUES ($1,$2,$3,'MANUAL','Diretor comercial','Representante legal','SIGNED',now(),$4)`,
      [tenantId, signatureId, signedDocumentId, actorId],
    );
    await evidenceSetup.end();
    for (const status of ['SIGNED', 'ACTIVE'] as const) {
      const transition = await server.inject({
        method: 'POST', url: `/v1/inventory/sales-contracts/${sale.json().id}/transition`, headers,
        payload: { status, reason: null },
      });
      expect(transition.statusCode, transition.body).toBe(201);
    }

    const allocation = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: initial.json().lots[0].id, quantityKg: '10000.000' },
    });
    expect(allocation.statusCode, allocation.body).toBe(201);
    expect(allocation.json()).toMatchObject({ salesContractVersionNumber: 5 });

    const overflow = await server.inject({
      method: 'POST', url: '/v1/inventory/allocations', headers,
      payload: { salesContractId: sale.json().id, lotId: initial.json().lots[0].id, quantityKg: '1.000' },
    });
    expect(overflow.statusCode).toBe(422);
    expect(overflow.json()).toMatchObject({ code: 'ALLOCATION_EXCEEDS_CONTRACT_BALANCE' });

    const deliveryPolicy = await server.inject({
      method: 'POST', url: '/v1/inventory/delivery-requirement-policies', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', terminalCode: 'IND_PR_01',
        requirementType: 'PORTAL_CONFIRMATION', title: 'Enviar ticket no portal do sacado',
        responsibleName: 'Mesa logística', dueHoursAfterDispatch: 24,
        portalName: 'Portal fictício do sacado', portalUrl: 'https://example.invalid/portal',
        consequence: 'BLOCK_ANTICIPATION',
      },
    });
    expect(deliveryPolicy.statusCode, deliveryPolicy.body).toBe(201);
    expect(deliveryPolicy.json()).toMatchObject({ version: 1, active: true,
      consequence: 'BLOCK_ANTICIPATION' });

    const dispatch = await server.inject({
      method: 'POST', url: '/v1/inventory/dispatches', headers,
      payload: { allocationId: allocation.json().id, quantityKg: '4000.000',
        dispatchedAt: '2026-10-02T10:00:00-03:00', vehiclePlate: 'MNO-4P56',
        documentReference: 'NF-TESTE-2', notes: 'Expedição parcial de teste.' },
    });
    expect(dispatch.statusCode, dispatch.body).toBe(201);

    const destinationReceipt = await server.inject({
      method: 'POST', url: `/v1/inventory/dispatches/${dispatch.json().id}/destination-receipts`, headers,
      payload: {
        destinationWeightKg: '4200.000', unloadedAt: '2026-10-02T16:00:00-03:00',
        terminalCode: 'IND_PR_01', ticketReference: 'TICKET-DEST-001',
        destinationDocumentReference: 'ROM-DEST-001', reason: 'Primeiro peso informado pelo destino.', notes: null,
      },
    });
    expect(destinationReceipt.statusCode, destinationReceipt.body).toBe(201);
    expect(destinationReceipt.json()).toMatchObject({
      version: 1, dispatchedWeightKg: '4000.000', destinationWeightKg: '4200.000',
      differenceKg: '200.000', financialEffectStatus: 'PENDING_POLICY',
    });
    const correctedDestinationReceipt = await server.inject({
      method: 'POST', url: `/v1/inventory/dispatches/${dispatch.json().id}/destination-receipts`, headers,
      payload: {
        destinationWeightKg: '3900.000', unloadedAt: '2026-10-02T16:00:00-03:00',
        terminalCode: 'IND_PR_01', ticketReference: 'TICKET-DEST-001-R1',
        destinationDocumentReference: 'ROM-DEST-001', reason: 'Correção após conferência do ticket.', notes: null,
      },
    });
    expect(correctedDestinationReceipt.statusCode, correctedDestinationReceipt.body).toBe(201);
    expect(correctedDestinationReceipt.json()).toMatchObject({
      version: 2, differenceKg: '-100.000', financialEffectStatus: 'PENDING_POLICY',
    });

    const requirementWorkspace = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    const requirement = requirementWorkspace.json().deliveryRequirements.find(
      (item: { dispatch_id: string }) => item.dispatch_id === dispatch.json().id,
    );
    expect(requirement).toMatchObject({
      policy_version: 1, status: 'PENDING', responsible_name: 'Mesa logística',
      portal_name: 'Portal fictício do sacado', consequence: 'BLOCK_ANTICIPATION',
    });
    const submittedRequirement = await server.inject({
      method: 'PUT', url: `/v1/inventory/delivery-requirements/${requirement.id}`, headers,
      payload: {
        status: 'SUBMITTED', evidenceReference: 'TICKET-DEST-001-R1',
        portalConfirmation: 'PROTOCOLO-FICTICIO-001', notes: 'Envio sintético de homologação.',
        reason: 'Ticket enviado manualmente ao portal de teste.',
      },
    });
    expect(submittedRequirement.statusCode, submittedRequirement.body).toBe(200);
    expect(submittedRequirement.json()).toMatchObject({
      status: 'SUBMITTED', portal_confirmation: 'PROTOCOLO-FICTICIO-001', resolved_at: null,
    });
    const revisedDeliveryPolicy = await server.inject({
      method: 'POST', url: '/v1/inventory/delivery-requirement-policies', headers,
      payload: {
        counterpartyId: 'd1000000-0000-4000-8000-000000000005', terminalCode: 'IND_PR_01',
        requirementType: 'PORTAL_CONFIRMATION', title: 'Enviar ticket no portal do sacado',
        responsibleName: 'Backoffice logístico', dueHoursAfterDispatch: 48,
        portalName: 'Portal fictício do sacado', portalUrl: 'https://example.invalid/portal',
        consequence: 'BLOCK_ANTICIPATION',
      },
    });
    expect(revisedDeliveryPolicy.statusCode, revisedDeliveryPolicy.body).toBe(201);
    expect(revisedDeliveryPolicy.json()).toMatchObject({ version: 2, active: true,
      responsible_name: 'Backoffice logístico' });

    const final = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    expect(final.json()).toMatchObject({
      summary: { physicalWeightKg: '20920.000', committedWeightKg: '18000.000', availableWeightKg: '2920.000' },
    });
    expect(final.json().movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'DISPATCH', quantityDeltaKg: '-4000.000', allocationId: allocation.json().id }),
    ]));
    expect(final.json().dispatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: dispatch.json().id, destination_receipt_version: 2,
        destination_weight_kg: '3900.000', destination_difference_kg: '-100.000',
        ticket_reference: 'TICKET-DEST-001-R1' }),
    ]));
    expect(final.json().deliveryRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: requirement.id, status: 'SUBMITTED',
        policy_version: 1, responsible_name: 'Mesa logística',
        consequence: 'BLOCK_ANTICIPATION', portal_confirmation: 'PROTOCOLO-FICTICIO-001' }),
    ]));
    expect(final.json().deliveryRequirementPolicies).toEqual(expect.arrayContaining([
      expect.objectContaining({ version: 2, active: true, responsible_name: 'Backoffice logístico' }),
    ]));
    expect(final.json().economicReconciliations).toEqual(expect.arrayContaining([
      expect.objectContaining({ dispatch_id: dispatch.json().id, source_load_id: initial.json().lots[0].sourceLoadId,
        sales_contract_reference: 'CV-2026-0043', revenue_amount: '6400.00',
        fiscal_document_id: null, title_id: null, settled_amount: '0.00', outstanding_amount: null }),
    ]));

    const location = await server.inject({
      method: 'POST', url: '/v1/inventory/locations', headers,
      payload: { code: 'ARMAZEM_02', name: 'Armazém secundário' },
    });
    expect(location.statusCode, location.body).toBe(201);
    const lotId = initial.json().lots[0].id;
    const classification = await server.inject({
      method: 'PUT', url: `/v1/inventory/lots/${lotId}/classification`, headers,
      payload: { ownershipStatus: 'OWN', riskStatus: 'ASSUMED', custodyStatus: 'IN_STORAGE',
        ownerCounterpartyId: null, custodianCounterpartyId: null,
        occurredAt: '2026-10-02T11:00:00-03:00', reason: 'Classificação operacional homologada.' },
    });
    expect(classification.statusCode, classification.body).toBe(200);

    const transfer = await server.inject({
      method: 'POST', url: `/v1/inventory/lots/${lotId}/transfers`, headers,
      payload: { destinationLocationId: location.json().id,
        startedAt: '2026-10-02T12:00:00-03:00', reason: 'Remaneio para capacidade operacional.' },
    });
    expect(transfer.statusCode, transfer.body).toBe(201);
    const completed = await server.inject({
      method: 'POST', url: `/v1/inventory/transfers/${transfer.json().id}/complete`, headers,
      payload: { completedAt: '2026-10-02T14:00:00-03:00', reason: 'Remaneio recebido e conferido.' },
    });
    expect(completed.statusCode, completed.body).toBe(201);

    const loss = await server.inject({
      method: 'POST', url: `/v1/inventory/lots/${lotId}/losses`, headers,
      payload: { quantityKg: '100.000', occurredAt: '2026-10-02T15:00:00-03:00',
        reason: 'Perda operacional apurada em conferência.' },
    });
    expect(loss.statusCode, loss.body).toBe(201);
    const count = await server.inject({
      method: 'POST', url: `/v1/inventory/lots/${lotId}/counts`, headers,
      payload: { countedQuantityKg: '20750.000', occurredAt: '2026-10-02T16:00:00-03:00',
        reason: 'Inventário físico mensal conferido.' },
    });
    expect(count.statusCode, count.body).toBe(201);

    const governed = await server.inject({ method: 'GET', url: '/v1/inventory', headers });
    expect(governed.statusCode, governed.body).toBe(200);
    expect(governed.json()).toMatchObject({
      summary: { physicalWeightKg: '20750.000' },
      transfers: [{ status: 'COMPLETED', destination_location_code: 'ARMAZEM_02' }],
      counts: [{ counted_quantity_kg: '20750.000', difference_kg: '-70.000' }],
    });
    expect(governed.json().movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'LOSS', quantityDeltaKg: '-100.000' }),
      expect.objectContaining({ type: 'COUNT_ADJUSTMENT', quantityDeltaKg: '-70.000' }),
    ]));
  });
});
