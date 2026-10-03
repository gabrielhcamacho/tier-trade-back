import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export const DEMO_SEED_VERSION = 9;

export type ResetDemoTenantInput = {
  tenantId: string;
  actorId: string;
};

export type ResetDemoTenantResult = {
  tenantId: string;
  seedVersion: number;
  counterparties: number;
  offers: number;
  contracts: number;
  loads: number;
  receipts: number;
  inventoryLots: number;
  inventoryMovements: number;
  salesContracts: number;
  allocations: number;
  dispatches: number;
  financialEvents: number;
  financialTitles: number;
  financialSettlements: number;
  fiscalDocuments: number;
  fiscalEstablishments: number;
  fiscalConfigurations: number;
  fiscalCalculations: number;
  riskPolicies: number;
};

const ids = {
  policy: 'd0000000-0000-4000-8000-000000000001',
  counterparties: [
    'd1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000003',
    'd1000000-0000-4000-8000-000000000004',
    'd1000000-0000-4000-8000-000000000005',
  ],
  offers: [
    'd2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000003',
    'd2000000-0000-4000-8000-000000000004',
  ],
  scenarios: [
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000002',
    'd3000000-0000-4000-8000-000000000003',
    'd3000000-0000-4000-8000-000000000004',
  ],
  approvals: [
    'd4000000-0000-4000-8000-000000000001',
    'd4000000-0000-4000-8000-000000000002',
    'd4000000-0000-4000-8000-000000000003',
  ],
  contracts: [
    'd5000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000002',
  ],
  obligations: [
    'd6000000-0000-4000-8000-000000000001',
    'd6000000-0000-4000-8000-000000000002',
    'd6000000-0000-4000-8000-000000000003',
    'd6000000-0000-4000-8000-000000000004',
  ],
  loads: [
    'd7000000-0000-4000-8000-000000000001',
    'd7000000-0000-4000-8000-000000000002',
    'd7000000-0000-4000-8000-000000000003',
  ],
  receipts: [
    'd8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000002',
  ],
  inventory: {
    location: 'd9000000-0000-4000-8000-000000000001',
    lot: 'da000000-0000-4000-8000-000000000001',
    movement: 'db000000-0000-4000-8000-000000000001',
  },
  fulfillment: {
    salesContract: 'dc000000-0000-4000-8000-000000000001',
    allocation: 'dd000000-0000-4000-8000-000000000001',
    dispatch: 'de000000-0000-4000-8000-000000000001',
    movement: 'df000000-0000-4000-8000-000000000001',
  },
  finance: {
    event: 'e0000000-0000-4000-8000-000000000001',
    title: 'e1000000-0000-4000-8000-000000000001',
    settlement: 'e2000000-0000-4000-8000-000000000001',
  },
  fiscalDocument: 'e4000000-0000-4000-8000-000000000001',
  fiscalEstablishment: 'e5000000-0000-4000-8000-000000000001',
  fiscalConfiguration: 'e6000000-0000-4000-8000-000000000001',
  riskPolicy: 'e3000000-0000-4000-8000-000000000001',
} as const;

export async function resetDemoTenant(
  pool: Pool,
  input: ResetDemoTenantInput,
): Promise<ResetDemoTenantResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('tier-trade-demo-reset:' || $1, 0))", [input.tenantId]);

    const tenant = await client.query<{ is_demo: boolean }>(
      'SELECT is_demo FROM app.tenants WHERE id=$1 FOR UPDATE',
      [input.tenantId],
    );
    if (tenant.rowCount !== 1) throw new Error('DEMO_TENANT_NOT_FOUND');
    if (!tenant.rows[0]?.is_demo) throw new Error('TENANT_IS_NOT_MARKED_AS_DEMO');

    const membership = await client.query<{ capabilities: string[] }>(
      `SELECT capabilities FROM app.memberships
        WHERE tenant_id=$1 AND user_id=$2 AND active=true`,
      [input.tenantId, input.actorId],
    );
    if (membership.rowCount !== 1) throw new Error('ACTIVE_DEMO_ACTOR_MEMBERSHIP_NOT_FOUND');
    const capabilities = membership.rows[0]?.capabilities ?? [];
    if (!capabilities.includes('COMMERCIAL_EDIT') || !capabilities.includes('OPERATIONS_EDIT')
      || !capabilities.includes('FINANCE_EDIT') || !capabilities.includes('FISCAL_EDIT')
      || !capabilities.includes('RISK_MANAGE')) {
      throw new Error('DEMO_ACTOR_CAPABILITIES_INCOMPLETE');
    }

    await client.query(
      `UPDATE app.outbox_events
          SET published_at=COALESCE(published_at,now()),locked_at=NULL,lock_owner=NULL,last_error=NULL
        WHERE tenant_id=$1`,
      [input.tenantId],
    );
    await clearOperationalData(client, input.tenantId, input.actorId);
    await seedOperationalData(client, input);

    await client.query(
      `UPDATE app.tenants
          SET legal_name='Cerrado Trading — Demonstração',
              timezone='America/Sao_Paulo',
              demo_seed_version=$2
        WHERE id=$1`,
      [input.tenantId, DEMO_SEED_VERSION],
    );

    await client.query('COMMIT');
    return {
      tenantId: input.tenantId,
      seedVersion: DEMO_SEED_VERSION,
      counterparties: ids.counterparties.length,
      offers: ids.offers.length,
      contracts: ids.contracts.length,
      loads: ids.loads.length,
      receipts: ids.receipts.length,
      inventoryLots: 1,
      inventoryMovements: 2,
      salesContracts: 1,
      allocations: 1,
      dispatches: 1,
      financialEvents: 1,
      financialTitles: 1,
      financialSettlements: 1,
      fiscalDocuments: 1,
      fiscalEstablishments: 1,
      fiscalConfigurations: 1,
      fiscalCalculations: 0,
      riskPolicies: 1,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function clearOperationalData(client: PoolClient, tenantId: string, actorId: string): Promise<void> {
  await client.query('SELECT app.delete_demo_risk($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_fiscal_configuration($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_fiscal($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_finance($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_sales_fulfillment($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_inventory($1,$2)', [tenantId, actorId]);
  await client.query('SELECT app.delete_demo_load_receipts($1,$2)', [tenantId, actorId]);
  for (const table of [
    'contract_summary_read_model',
    'commercial_activity_read_model',
    'loads',
    'contract_obligations',
    'contracts',
    'approvals',
    'pricing_scenarios',
    'offers',
    'margin_policies',
    'counterparties',
  ]) {
    await client.query(`DELETE FROM app.${table} WHERE tenant_id=$1`, [tenantId]);
  }
}

async function seedOperationalData(client: PoolClient, input: ResetDemoTenantInput): Promise<void> {
  const { tenantId, actorId } = input;
  await client.query(
    `INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id,created_at) VALUES
      ($1,$2,'Fazenda Boa Esperança — Dado fictício','99000000000101','2026-09-08T13:00:00Z'),
      ($1,$3,'Cooperativa Vale do Cerrado — Dado fictício','99000000000102','2026-09-10T14:30:00Z'),
      ($1,$4,'Agropecuária Santa Luzia — Dado fictício','99000000000103','2026-09-15T12:00:00Z'),
      ($1,$5,'Cerealista Rio Verde — Dado fictício','99000000000104','2026-09-18T15:45:00Z'),
      ($1,$6,'Indústria Alimentícia Horizonte — Dado fictício','99000000000105','2026-09-20T13:20:00Z')`,
    [tenantId, ...ids.counterparties],
  );
  await client.query(
    `INSERT INTO app.margin_policies
      (tenant_id,id,commodity,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc,active,created_at)
     VALUES ($1,$2,'MILHO',1,8.500000,3.000000,true,'2026-09-01T12:00:00Z')`,
    [tenantId, ids.policy],
  );

  const offers = [
    [ids.offers[0], ids.counterparties[0], '20000', '2026-10-15', '2026-12-15', 'CONVERTED', '2026-09-12T13:00:00Z'],
    [ids.offers[1], ids.counterparties[1], '12500', '2026-10-20', '2026-12-20', 'CONVERTED', '2026-09-16T14:00:00Z'],
    [ids.offers[2], ids.counterparties[2], '8000', '2026-11-01', '2027-01-15', 'IN_APPROVAL', '2026-09-25T16:00:00Z'],
    [ids.offers[3], ids.counterparties[3], '5000', '2026-11-10', '2027-01-31', 'DRAFT', '2026-10-01T15:00:00Z'],
  ] as const;
  for (const offer of offers) {
    await client.query(
      `INSERT INTO app.offers
        (tenant_id,id,counterparty_id,commodity,unit,quantity_sc,delivery_start,delivery_end,status,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,'MILHO','SC_60KG',$4,$5,$6,$7,$8,$9,$9)`,
      [tenantId, offer[0], offer[1], offer[2], offer[3], offer[4], offer[5], actorId, offer[6]],
    );
  }

  const scenarios = [
    [ids.scenarios[0], ids.offers[0], '68.400000', '82.300000', '5.150000', '8.750000',
      [{ code: 'FREIGHT', amountPerSc: '3.10' }, { code: 'STORAGE', amountPerSc: '0.85' }, { code: 'FINANCIAL', amountPerSc: '1.20' }]],
    [ids.scenarios[1], ids.offers[1], '70.100000', '83.000000', '5.450000', '7.450000',
      [{ code: 'FREIGHT', amountPerSc: '3.35' }, { code: 'QUALITY', amountPerSc: '0.60' }, { code: 'FINANCIAL', amountPerSc: '1.50' }]],
    [ids.scenarios[2], ids.offers[2], '72.400000', '83.100000', '4.800000', '5.900000',
      [{ code: 'FREIGHT', amountPerSc: '3.20' }, { code: 'STORAGE', amountPerSc: '0.55' }, { code: 'FINANCIAL', amountPerSc: '1.05' }]],
    [ids.scenarios[3], ids.offers[3], '69.800000', '80.500000', '5.100000', '5.600000',
      [{ code: 'FREIGHT', amountPerSc: '3.40' }, { code: 'STORAGE', amountPerSc: '0.70' }, { code: 'OTHER', amountPerSc: '1.00' }]],
  ] as const;
  for (const scenario of scenarios) {
    await client.query(
      `INSERT INTO app.pricing_scenarios
        (tenant_id,id,offer_id,policy_id,policy_version,purchase_price_per_sc,sale_reference_per_sc,
         total_costs_per_sc,projected_margin_per_sc,cost_breakdown,created_by,created_at,version,is_current)
       VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,$9::jsonb,$10,'2026-10-01T12:00:00Z',1,true)`,
      [tenantId, scenario[0], scenario[1], ids.policy, scenario[2], scenario[3], scenario[4], scenario[5],
        JSON.stringify(scenario[6]), actorId],
    );
  }

  await client.query(
    `INSERT INTO app.approvals
      (tenant_id,id,offer_id,status,requested_by,decided_by,requested_at,decided_at) VALUES
      ($1,$2,$3,'APPROVED',$8,$8,'2026-09-12T14:00:00Z','2026-09-12T15:00:00Z'),
      ($1,$4,$5,'APPROVED',$8,$8,'2026-09-16T15:00:00Z','2026-09-16T16:00:00Z'),
      ($1,$6,$7,'PENDING',$8,NULL,'2026-09-25T17:00:00Z',NULL)`,
    [tenantId, ids.approvals[0], ids.offers[0], ids.approvals[1], ids.offers[1],
      ids.approvals[2], ids.offers[2], actorId],
  );
  await client.query(
    `INSERT INTO app.contracts (tenant_id,id,offer_id,status,created_by,activated_at) VALUES
      ($1,$2,$3,'ACTIVE',$6,'2026-09-12T15:10:00Z'),
      ($1,$4,$5,'ACTIVE',$6,'2026-09-16T16:10:00Z')`,
    [tenantId, ids.contracts[0], ids.offers[0], ids.contracts[1], ids.offers[1], actorId],
  );
  await client.query(
    `INSERT INTO app.contract_obligations
      (tenant_id,id,contract_id,code,status,completed_at) VALUES
      ($1,$2,$6,'SIGNED_CONTRACT','COMPLETED','2026-09-13T12:00:00Z'),
      ($1,$3,$6,'DELIVERY_SCHEDULE','COMPLETED','2026-09-20T12:00:00Z'),
      ($1,$4,$7,'SIGNED_CONTRACT','COMPLETED','2026-09-18T12:00:00Z'),
      ($1,$5,$7,'DELIVERY_SCHEDULE','PENDING',NULL)`,
    [tenantId, ...ids.obligations, ...ids.contracts],
  );
  await client.query(
    `INSERT INTO app.loads
      (tenant_id,id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,carrier_name,destination_code,status,created_by,created_at,updated_at) VALUES
      ($1,$2,$5,'2026-10-15T11:00:00Z',48000.000,'ABC1D23','Transportadora Horizonte — Dado fictício','ARMAZEM_GO_01','RECEIVED',$7,'2026-09-22T13:00:00Z','2026-10-01T12:15:00Z'),
      ($1,$3,$5,'2026-10-17T15:30:00Z',51000.000,'DEF4G56','Logística do Cerrado — Dado fictício','ARMAZEM_GO_01','IN_RECEIVING',$7,'2026-09-23T14:00:00Z','2026-10-01T14:05:00Z'),
      ($1,$4,$6,'2026-10-22T12:00:00Z',45000.000,'GHI7J89','Transportadora Horizonte — Dado fictício','TERMINAL_SP_02','SCHEDULED',$7,'2026-09-27T12:00:00Z','2026-09-27T12:00:00Z')`,
    [tenantId, ...ids.loads, ...ids.contracts, actorId],
  );
  await client.query(
    `INSERT INTO app.load_receipts
      (tenant_id,id,load_id,version,is_current,received_at,gross_weight_kg,tare_weight_kg,
       weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,impurity_pct,
       damaged_pct,quality_decision,notes,created_by,created_at) VALUES
      ($1,$2,$4,1,true,'2026-10-01T12:05:00Z',48260.000,15340.000,
       'SCALE','TB-2026-001',NULL,13.2000,1.1000,2.3000,'ACCEPTED',
       'Recebimento fictício dentro do padrão informado pelo operador.',$6,'2026-10-01T12:15:00Z'),
      ($1,$3,$5,1,true,'2026-10-01T14:00:00Z',50780.000,14920.000,
       'MANUAL_CONTINGENCY',NULL,'Balança integrada indisponível durante o recebimento.',14.8000,2.4000,5.1000,
       'REVIEW_REQUIRED','Dado fictício aguardando decisão humana de qualidade.',$6,'2026-10-01T14:05:00Z')`,
    [tenantId, ...ids.receipts, ids.loads[0], ids.loads[1], actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_locations
      (tenant_id,id,code,name,status,created_by,created_at)
     VALUES ($1,$2,'ARMAZEM_GO_01','Armazém Goiás 01','ACTIVE',$3,'2026-09-01T12:00:00Z')`,
    [tenantId, ids.inventory.location, actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_lots
      (tenant_id,id,lot_code,source_load_id,contract_id,location_id,commodity,status,
       ownership_status,risk_status,custody_status,created_by,created_at,updated_at)
     VALUES ($1,$2,'LT-GO-26-0001',$3,$4,$5,'MILHO','AVAILABLE',
       'PENDING_DEFINITION','PENDING_DEFINITION','IN_STORAGE',$6,
       '2026-10-01T12:15:00Z','2026-10-01T12:15:00Z')`,
    [tenantId, ids.inventory.lot, ids.loads[0], ids.contracts[0],
      ids.inventory.location, actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_movements
      (tenant_id,id,lot_id,source_load_id,source_receipt_id,movement_type,
       quantity_delta_kg,occurred_at,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,'RECEIPT',32920.000,'2026-10-01T12:05:00Z',$6,'2026-10-01T12:15:00Z')`,
    [tenantId, ids.inventory.movement, ids.inventory.lot, ids.loads[0],
      ids.receipts[0], actorId],
  );
  await client.query(
    `INSERT INTO app.sales_contracts
      (tenant_id,id,counterparty_id,reference,commodity,quantity_kg,sale_price_per_kg,
       destination_code,delivery_start,delivery_end,required_documents,payment_term_days,status,created_by,created_at,updated_at)
     VALUES ($1,$2,$3,'CV-2026-0042','MILHO',20000.000,1.420000,'IND_SP_01',
       '2026-10-01','2026-10-31',ARRAY['Nota fiscal','Romaneio de pesagem'],7,'ACTIVE',$4,
       '2026-09-28T12:00:00Z','2026-09-28T12:00:00Z')`,
    [tenantId, ids.fulfillment.salesContract, ids.counterparties[4], actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_allocations
      (tenant_id,id,sales_contract_id,lot_id,quantity_kg,status,created_by,created_at)
     VALUES ($1,$2,$3,$4,20000.000,'ACTIVE',$5,'2026-10-01T13:00:00Z')`,
    [tenantId, ids.fulfillment.allocation, ids.fulfillment.salesContract, ids.inventory.lot, actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_dispatches
      (tenant_id,id,allocation_id,quantity_kg,dispatched_at,vehicle_plate,document_reference,notes,created_by,created_at)
     VALUES ($1,$2,$3,8000.000,'2026-10-01T16:00:00Z','JKL1M23','NF-DEMO-0001',
       'Expedição parcial fictícia para demonstração.',$4,'2026-10-01T16:05:00Z')`,
    [tenantId, ids.fulfillment.dispatch, ids.fulfillment.allocation, actorId],
  );
  await client.query(
    `INSERT INTO app.inventory_movements
      (tenant_id,id,lot_id,allocation_id,dispatch_id,movement_type,quantity_delta_kg,occurred_at,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,'DISPATCH',-8000.000,'2026-10-01T16:00:00Z',$6,'2026-10-01T16:05:00Z')`,
    [tenantId, ids.fulfillment.movement, ids.inventory.lot, ids.fulfillment.allocation,
      ids.fulfillment.dispatch, actorId],
  );
  await client.query(
    `INSERT INTO app.financial_events
      (tenant_id,id,event_type,source_type,source_id,sales_contract_id,counterparty_id,direction,
       quantity_kg,unit_price,raw_amount,calculated_amount,calculation_status,expected_on,
       formula_code,formula_version,calculation_memory,created_by,created_at)
     VALUES ($1,$2,'SALE_DISPATCH_RECEIVABLE','INVENTORY_DISPATCH',$3,$4,$5,'INFLOW',
       8000.000,1.420000,11360.000000000,11360.00,'READY','2026-10-08',
       'SALE_DISPATCH_GROSS',1,$6::jsonb,$7,'2026-10-01T16:05:00Z')`,
    [tenantId, ids.finance.event, ids.fulfillment.dispatch, ids.fulfillment.salesContract,
      ids.counterparties[4], JSON.stringify({
        quantityKg: '8000.000', unitPricePerKg: '1.420000',
        operation: 'quantityKg × unitPricePerKg', rawAmount: '11360.000000000',
        currency: 'BRL', rounding: 'NOT_REQUIRED_EXACT_CENTS',
      }), actorId],
  );
  await client.query(
    `INSERT INTO app.fiscal_documents
      (tenant_id,id,document_type,direction,source_type,source_id,sales_contract_id,
       financial_event_id,document_number,access_key,issued_at,total_amount,status,
       validation_notes,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'NFE','OUTBOUND','INVENTORY_DISPATCH',$3,$4,$5,'NFE-DEMO-0001',
       '99000000000000000000000000000000000000000001','2026-10-01T16:10:00Z',11360.00,
       'RECEIVED','Documento fiscal fictício pronto para validação na demonstração.',$6,$6,
       '2026-10-01T16:15:00Z','2026-10-01T16:15:00Z')`,
    [tenantId, ids.fiscalDocument, ids.fulfillment.dispatch, ids.fulfillment.salesContract,
      ids.finance.event, actorId],
  );
  await client.query(
    `INSERT INTO app.fiscal_establishments
      (tenant_id,id,legal_name,tax_id,state_registration,uf,tax_regime,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'Cerrado Trading — Estabelecimento fictício','99000000000199',NULL,'GO',NULL,$3,$3,
       '2026-10-01T12:00:00Z','2026-10-01T12:00:00Z')`,
    [tenantId, ids.fiscalEstablishment, actorId],
  );
  await client.query(
    `INSERT INTO app.fiscal_configuration_versions
      (tenant_id,id,configuration_key,version,establishment_id,name,operation_type,commodity,
       destination_uf,cfop,emission_strategy,technical_responsible,effective_from,effective_to,
       tax_components,status,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$2,1,$3,'Venda interestadual de milho — configuração pendente','SALE_DISPATCH','MILHO',
       'SP',NULL,NULL,NULL,'2026-10-01',NULL,'[]'::jsonb,'DRAFT',$4,$4,
       '2026-10-01T12:00:00Z','2026-10-01T12:00:00Z')`,
    [tenantId, ids.fiscalConfiguration, ids.fiscalEstablishment, actorId],
  );
  await client.query(
    `INSERT INTO app.financial_titles
      (tenant_id,id,financial_event_id,title_number,document_reference,due_date,amount,status,issued_by,issued_at)
     VALUES ($1,$2,$3,'TR-2026-0001','NFE-DEMO-0001','2026-10-08',11360.00,
       'PARTIALLY_SETTLED',$4,'2026-10-01T16:20:00Z')`,
    [tenantId, ids.finance.title, ids.finance.event, actorId],
  );
  await client.query(
    `INSERT INTO app.financial_settlements
      (tenant_id,id,title_id,amount,received_at,bank_reference,notes,created_by,created_at)
     VALUES ($1,$2,$3,4000.00,'2026-10-02T13:00:00Z','PIX-DEMO-0001',
       'Recebimento parcial fictício para demonstração.',$4,'2026-10-02T13:05:00Z')`,
    [tenantId, ids.finance.settlement, ids.finance.title, actorId],
  );
  await client.query(
    `INSERT INTO app.risk_policies
      (tenant_id,id,commodity,version,max_net_open_kg,warning_threshold_pct,active,created_by,created_at)
     VALUES ($1,$2,'MILHO',1,2100000.000,80.00,true,$3,'2026-10-01T12:00:00Z')`,
    [tenantId, ids.riskPolicy, actorId],
  );

  await seedReadModelsAndAudit(client, input);
}

async function seedReadModelsAndAudit(client: PoolClient, input: ResetDemoTenantInput): Promise<void> {
  const contractEvents = [randomUUID(), randomUUID()];
  const resetEvent = randomUUID();
  const events = [
    { id: contractEvents[0]!, type: 'contract.activated', aggregate: 'contract', aggregateId: ids.contracts[0], occurredAt: '2026-09-12T15:10:00Z', payload: {} },
    { id: contractEvents[1]!, type: 'contract.activated', aggregate: 'contract', aggregateId: ids.contracts[1], occurredAt: '2026-09-16T16:10:00Z', payload: {} },
    { id: randomUUID(), type: 'load.scheduled', aggregate: 'load', aggregateId: ids.loads[0], occurredAt: '2026-09-22T13:00:00Z', payload: { expectedWeightKg: '48000.000' } },
    { id: randomUUID(), type: 'load.scheduled', aggregate: 'load', aggregateId: ids.loads[1], occurredAt: '2026-09-23T14:00:00Z', payload: { expectedWeightKg: '51000.000' } },
    { id: randomUUID(), type: 'load.scheduled', aggregate: 'load', aggregateId: ids.loads[2], occurredAt: '2026-09-27T12:00:00Z', payload: { expectedWeightKg: '45000.000' } },
    { id: randomUUID(), type: 'load.receipt_recorded', aggregate: 'load', aggregateId: ids.loads[0], occurredAt: '2026-10-01T12:15:00Z', payload: { version: 1, netWeightKg: '32920.000', qualityDecision: 'ACCEPTED' } },
    { id: randomUUID(), type: 'load.receipt_recorded', aggregate: 'load', aggregateId: ids.loads[1], occurredAt: '2026-10-01T14:05:00Z', payload: { version: 1, netWeightKg: '35860.000', qualityDecision: 'REVIEW_REQUIRED' } },
    { id: randomUUID(), type: 'finance.forecast_projected', aggregate: 'financial_event', aggregateId: ids.finance.event, occurredAt: '2026-10-01T16:05:00Z', payload: { sourceId: ids.fulfillment.dispatch, calculatedAmount: '11360.00' } },
    { id: randomUUID(), type: 'fiscal.document_received', aggregate: 'fiscal_document', aggregateId: ids.fiscalDocument, occurredAt: '2026-10-01T16:15:00Z', payload: { financialEventId: ids.finance.event, documentNumber: 'NFE-DEMO-0001' } },
    { id: randomUUID(), type: 'finance.title_issued', aggregate: 'financial_title', aggregateId: ids.finance.title, occurredAt: '2026-10-01T16:20:00Z', payload: { financialEventId: ids.finance.event, amount: '11360.00' } },
    { id: randomUUID(), type: 'finance.receipt_recorded', aggregate: 'financial_settlement', aggregateId: ids.finance.settlement, occurredAt: '2026-10-02T13:05:00Z', payload: { titleId: ids.finance.title, amount: '4000.00' } },
    { id: randomUUID(), type: 'risk.policy_configured', aggregate: 'risk_policy', aggregateId: ids.riskPolicy, occurredAt: '2026-10-01T12:00:00Z', payload: { commodity: 'MILHO', version: 1, maxNetOpenKg: '2100000.000', warningThresholdPct: '80.00' } },
    { id: resetEvent, type: 'demo.seed_reset', aggregate: 'tenant', aggregateId: input.tenantId, occurredAt: new Date().toISOString(), payload: {} },
  ];
  for (const event of events) {
    const payload = JSON.stringify({ demoSeedVersion: DEMO_SEED_VERSION, seeded: true, ...event.payload });
    await client.query(
      `INSERT INTO app.audit_events
        (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload,occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [input.tenantId, event.id, input.actorId, event.type, event.aggregate, event.aggregateId, payload, event.occurredAt],
    );
    await client.query(
      `INSERT INTO app.outbox_events
        (tenant_id,id,event_type,aggregate_type,aggregate_id,payload,occurred_at,published_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
      [input.tenantId, event.id, event.type, event.aggregate, event.aggregateId, payload, event.occurredAt],
    );
    await client.query(
      `INSERT INTO app.commercial_activity_read_model
        (tenant_id,event_id,event_type,aggregate_type,aggregate_id,payload,occurred_at,projected_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
      [input.tenantId, event.id, event.type, event.aggregate, event.aggregateId, payload, event.occurredAt],
    );
  }

  await client.query(
    `INSERT INTO app.contract_summary_read_model
      (tenant_id,contract_id,offer_id,status,commodity,unit,quantity_sc,delivery_start,delivery_end,
       purchase_price_per_sc,sale_reference_per_sc,total_costs_per_sc,projected_margin_per_sc,
       policy_version,obligations,source_event_id,projected_at)
     SELECT c.tenant_id,c.id,c.offer_id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,o.delivery_end,
            s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,s.projected_margin_per_sc,
            s.policy_version,
            COALESCE(jsonb_agg(jsonb_build_object('code',ob.code,'status',ob.status) ORDER BY ob.code)
              FILTER (WHERE ob.id IS NOT NULL),'[]'::jsonb),
            CASE c.id WHEN $2 THEN $4::uuid ELSE $5::uuid END,now()
       FROM app.contracts c
       JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
       JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
       LEFT JOIN app.contract_obligations ob ON (ob.tenant_id,ob.contract_id)=(c.tenant_id,c.id)
      WHERE c.tenant_id=$1 AND c.id IN ($2,$3)
      GROUP BY c.tenant_id,c.id,c.offer_id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,o.delivery_end,
               s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,s.projected_margin_per_sc,
               s.policy_version`,
    [input.tenantId, ids.contracts[0], ids.contracts[1], contractEvents[0], contractEvents[1]],
  );
}
