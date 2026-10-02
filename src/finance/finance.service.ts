import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { FinancialProjectionPort, type ProjectSalesDispatchInput } from './finance.port.js';
import type { CreateTitleInput, ReverseSettlementInput, SettleTitleInput } from './finance.schemas.js';

type FinancialEventRow = {
  id: string;
  source_id: string;
  sales_contract_id: string;
  contract_reference: string;
  counterparty_id: string;
  counterparty_name: string;
  document_reference: string;
  dispatched_at: Date;
  quantity_kg: string;
  unit_price: string;
  raw_amount: string;
  calculated_amount: string | null;
  calculation_status: string;
  expected_on: string | null;
  formula_code: string;
  formula_version: number;
  calculation_memory: Record<string, unknown>;
  title_id: string | null;
  title_number: string | null;
  title_document_reference: string | null;
  due_date: string | null;
  title_amount: string | null;
  title_status: string | null;
  settled_amount: string;
};

type SettlementRow = {
  id: string;
  title_id: string;
  title_number: string;
  amount: string;
  received_at: Date;
  bank_reference: string;
  notes: string | null;
  reversed_at: Date | null;
  reversal_reason: string | null;
};

@Injectable()
export class FinanceService extends FinancialProjectionPort {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {
    super();
  }

  workspace(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await client.query<{ legal_name: string; is_demo: boolean; demo_seed_version: number | null }>(
        'SELECT legal_name,is_demo,demo_seed_version FROM app.tenants WHERE id=$1', [tenantId]);
      const events = await client.query<FinancialEventRow>(
        `SELECT fe.id,fe.source_id,fe.sales_contract_id,sc.reference AS contract_reference,
                fe.counterparty_id,cp.legal_name AS counterparty_name,d.document_reference,d.dispatched_at,
                fe.quantity_kg::text,fe.unit_price::text,fe.raw_amount::text,fe.calculated_amount::text,
                fe.calculation_status,fe.expected_on::text,fe.formula_code,fe.formula_version,
                fe.calculation_memory,ft.id AS title_id,ft.title_number,
                ft.document_reference AS title_document_reference,ft.due_date::text,
                ft.amount::text AS title_amount,ft.status AS title_status,
                COALESCE(st.settled_amount,0)::text AS settled_amount
           FROM app.financial_events fe
           JOIN app.sales_contracts sc
             ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
           JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(fe.tenant_id,fe.counterparty_id)
           JOIN app.inventory_dispatches d
             ON (d.tenant_id,d.id)=(fe.tenant_id,fe.source_id)
           LEFT JOIN app.financial_titles ft
             ON (ft.tenant_id,ft.financial_event_id)=(fe.tenant_id,fe.id)
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(fs.amount) FILTER (WHERE fs.reversed_at IS NULL),0)::numeric(20,2) AS settled_amount
               FROM app.financial_settlements fs
              WHERE fs.tenant_id=ft.tenant_id AND fs.title_id=ft.id
           ) st ON true
          WHERE fe.tenant_id=$1
          ORDER BY fe.created_at DESC,fe.id DESC`, [tenantId]);
      const settlements = await client.query<SettlementRow>(
        `SELECT fs.id,fs.title_id,ft.title_number,fs.amount::text,fs.received_at,
                fs.bank_reference,fs.notes,fs.reversed_at,fs.reversal_reason
           FROM app.financial_settlements fs
           JOIN app.financial_titles ft ON (ft.tenant_id,ft.id)=(fs.tenant_id,fs.title_id)
          WHERE fs.tenant_id=$1 ORDER BY fs.received_at DESC,fs.id DESC`, [tenantId]);

      const projected = events.rows.reduce((sum, row) =>
        sum.plus(row.calculated_amount ?? 0), new Decimal(0));
      const receivable = events.rows.reduce((sum, row) =>
        sum.plus(row.title_amount ? new Decimal(row.title_amount).minus(row.settled_amount) : 0), new Decimal(0));
      const received = settlements.rows.filter((row) => !row.reversed_at)
        .reduce((sum, row) => sum.plus(row.amount), new Decimal(0));

      return {
        tenant: {
          legalName: tenant.rows[0]!.legal_name,
          isDemo: tenant.rows[0]!.is_demo,
          demoSeedVersion: tenant.rows[0]!.demo_seed_version,
        },
        summary: {
          projectedAmount: projected.toFixed(2),
          receivableAmount: receivable.toFixed(2),
          receivedAmount: received.toFixed(2),
          pendingForecastCount: events.rows.filter(
            (row) => !row.title_id && row.calculation_status === 'READY').length,
          pendingRoundingCount: events.rows.filter(
            (row) => row.calculation_status === 'PENDING_ROUNDING_POLICY').length,
        },
        events: events.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          salesContractId: row.sales_contract_id,
          contractReference: row.contract_reference,
          counterpartyId: row.counterparty_id,
          counterpartyName: row.counterparty_name,
          dispatchDocumentReference: row.document_reference,
          dispatchedAt: row.dispatched_at.toISOString(),
          quantityKg: row.quantity_kg,
          unitPrice: row.unit_price,
          rawAmount: row.raw_amount,
          calculatedAmount: row.calculated_amount,
          calculationStatus: row.calculation_status,
          expectedOn: row.expected_on,
          formulaCode: row.formula_code,
          formulaVersion: row.formula_version,
          calculationMemory: row.calculation_memory,
          title: row.title_id ? {
            id: row.title_id,
            number: row.title_number!,
            documentReference: row.title_document_reference!,
            dueDate: row.due_date!,
            amount: row.title_amount!,
            status: row.title_status!,
            settledAmount: row.settled_amount,
            outstandingAmount: new Decimal(row.title_amount!).minus(row.settled_amount).toFixed(2),
          } : null,
        })),
        settlements: settlements.rows.map((row) => ({
          id: row.id,
          titleId: row.title_id,
          titleNumber: row.title_number,
          amount: row.amount,
          receivedAt: row.received_at.toISOString(),
          bankReference: row.bank_reference,
          notes: row.notes,
          reversedAt: row.reversed_at?.toISOString() ?? null,
          reversalReason: row.reversal_reason,
        })),
      };
    });
  }

  createTitle(tenantId: string, actorId: string, input: CreateTitleInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const event = await client.query<{ calculation_status: string; calculated_amount: string | null }>(
        `SELECT calculation_status,calculated_amount::text FROM app.financial_events
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, input.financialEventId]);
      if (!event.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_EVENT_NOT_FOUND' });
      if (event.rows[0].calculation_status !== 'READY' || !event.rows[0].calculated_amount) {
        throw new ConflictException({ code: 'ROUNDING_POLICY_REQUIRED' });
      }
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.financial_titles
            (tenant_id,id,financial_event_id,title_number,document_reference,due_date,amount,issued_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tenantId, id, input.financialEventId, input.titleNumber, input.documentReference,
            input.dueDate, event.rows[0].calculated_amount, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'FINANCIAL_TITLE_ALREADY_EXISTS' });
        throw error;
      }
      await this.record(client, tenantId, actorId, 'finance.title_issued', 'financial_title', id, input);
      return { id, status: 'OPEN', amount: event.rows[0].calculated_amount, ...input };
    });
  }

  settle(tenantId: string, actorId: string, titleId: string, input: SettleTitleInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const title = await client.query<{ amount: string }>(
        `SELECT amount::text FROM app.financial_titles WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, titleId]);
      if (!title.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_TITLE_NOT_FOUND' });
      const paid = await client.query<{ amount: string }>(
        `SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text AS amount
           FROM app.financial_settlements WHERE tenant_id=$1 AND title_id=$2`, [tenantId, titleId]);
      const amount = new Decimal(input.amount);
      const remaining = new Decimal(title.rows[0].amount).minus(paid.rows[0]!.amount);
      if (amount.greaterThan(remaining)) {
        throw new UnprocessableEntityException({
          code: 'SETTLEMENT_EXCEEDS_TITLE_BALANCE', outstandingAmount: remaining.toFixed(2),
        });
      }
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.financial_settlements
            (tenant_id,id,title_id,amount,received_at,bank_reference,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tenantId, id, titleId, amount.toFixed(2), input.receivedAt,
            input.bankReference, input.notes, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'BANK_REFERENCE_ALREADY_USED' });
        throw error;
      }
      const outstanding = remaining.minus(amount);
      const status = outstanding.isZero() ? 'SETTLED' : 'PARTIALLY_SETTLED';
      await client.query('UPDATE app.financial_titles SET status=$3 WHERE tenant_id=$1 AND id=$2',
        [tenantId, titleId, status]);
      await this.record(client, tenantId, actorId, 'finance.receipt_recorded', 'financial_settlement', id,
        { titleId, ...input, amount: amount.toFixed(2) });
      return { id, titleId, amount: amount.toFixed(2), outstandingAmount: outstanding.toFixed(2), status };
    });
  }

  reverseSettlement(tenantId: string, actorId: string, settlementId: string,
    input: ReverseSettlementInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const settlement = await client.query<{ title_id: string; reversed_at: Date | null }>(
        `SELECT title_id,reversed_at FROM app.financial_settlements
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, settlementId]);
      if (!settlement.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_SETTLEMENT_NOT_FOUND' });
      if (settlement.rows[0].reversed_at) throw new ConflictException({ code: 'SETTLEMENT_ALREADY_REVERSED' });
      const titleId = settlement.rows[0].title_id;
      await client.query('SELECT 1 FROM app.financial_titles WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, titleId]);
      await client.query(
        `UPDATE app.financial_settlements
            SET reversed_at=now(),reversed_by=$3,reversal_reason=$4
          WHERE tenant_id=$1 AND id=$2`, [tenantId, settlementId, actorId, input.reason]);
      const balance = await client.query<{ amount: string; settled: string }>(
        `SELECT ft.amount::text,
                COALESCE(sum(fs.amount) FILTER (WHERE fs.reversed_at IS NULL),0)::text AS settled
           FROM app.financial_titles ft
           LEFT JOIN app.financial_settlements fs
             ON (fs.tenant_id,fs.title_id)=(ft.tenant_id,ft.id)
          WHERE ft.tenant_id=$1 AND ft.id=$2 GROUP BY ft.amount`, [tenantId, titleId]);
      const settled = new Decimal(balance.rows[0]!.settled);
      const status = settled.isZero()
        ? 'OPEN' : settled.equals(balance.rows[0]!.amount) ? 'SETTLED' : 'PARTIALLY_SETTLED';
      await client.query('UPDATE app.financial_titles SET status=$3 WHERE tenant_id=$1 AND id=$2',
        [tenantId, titleId, status]);
      await this.record(client, tenantId, actorId, 'finance.receipt_reversed', 'financial_settlement',
        settlementId, { titleId, reason: input.reason });
      return { id: settlementId, titleId, status, reversed: true };
    });
  }

  async projectSalesDispatch(client: PoolClient, input: ProjectSalesDispatchInput) {
    const source = await client.query<{
      quantity_kg: string; sale_price_per_kg: string; sales_contract_id: string;
      counterparty_id: string; dispatched_at: Date; expected_on: string | null;
    }>(
      `SELECT d.quantity_kg::text,sc.sale_price_per_kg::text,sc.id AS sales_contract_id,
              sc.counterparty_id,d.dispatched_at,
              CASE WHEN sc.payment_term_days IS NULL THEN NULL
                ELSE ((d.dispatched_at AT TIME ZONE t.timezone)::date + sc.payment_term_days)::text
              END AS expected_on
         FROM app.inventory_dispatches d
         JOIN app.inventory_allocations a
           ON (a.tenant_id,a.id)=(d.tenant_id,d.allocation_id)
         JOIN app.sales_contracts sc
           ON (sc.tenant_id,sc.id)=(a.tenant_id,a.sales_contract_id)
         JOIN app.tenants t ON t.id=d.tenant_id
        WHERE d.tenant_id=$1 AND d.id=$2`, [input.tenantId, input.dispatchId]);
    if (!source.rows[0]) throw new NotFoundException({ code: 'DISPATCH_NOT_FOUND' });
    const row = source.rows[0];
    const raw = new Decimal(row.quantity_kg).times(row.sale_price_per_kg);
    const exactCents = raw.decimalPlaces() <= 2;
    const id = randomUUID();
    const calculationStatus = exactCents ? 'READY' : 'PENDING_ROUNDING_POLICY';
    const memory = {
      quantityKg: new Decimal(row.quantity_kg).toFixed(3),
      unitPricePerKg: new Decimal(row.sale_price_per_kg).toFixed(6),
      operation: 'quantityKg × unitPricePerKg',
      rawAmount: raw.toFixed(9),
      currency: 'BRL',
      rounding: exactCents ? 'NOT_REQUIRED_EXACT_CENTS' : 'PENDING_TENANT_POLICY',
    };
    await client.query(
      `INSERT INTO app.financial_events
        (tenant_id,id,event_type,source_type,source_id,sales_contract_id,counterparty_id,
         direction,quantity_kg,unit_price,raw_amount,calculated_amount,calculation_status,
         expected_on,formula_code,formula_version,calculation_memory,created_by)
       VALUES ($1,$2,'SALE_DISPATCH_RECEIVABLE','INVENTORY_DISPATCH',$3,$4,$5,'INFLOW',
         $6,$7,$8,$9,$10,$11,'SALE_DISPATCH_GROSS',1,$12::jsonb,$13)`,
      [input.tenantId, id, input.dispatchId, row.sales_contract_id, row.counterparty_id,
        new Decimal(row.quantity_kg).toFixed(3), new Decimal(row.sale_price_per_kg).toFixed(6),
        raw.toFixed(9), exactCents ? raw.toFixed(2) : null, calculationStatus,
        row.expected_on, JSON.stringify(memory), input.actorId]);
    await this.record(client, input.tenantId, input.actorId, 'finance.forecast_projected',
      'financial_event', id, memory);
    return { financialEventId: id, calculationStatus };
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      'SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true',
      [tenantId, actorId]);
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query<{ capabilities: string[] }>(
      'SELECT capabilities FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true',
      [tenantId, actorId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
    if (!result.rows[0].capabilities.includes(capability)) {
      throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
    }
  }

  private async record(client: PoolClient, tenantId: string, actorId: string,
    eventType: string, aggregateType: string, aggregateId: string, payload: unknown) {
    const id = randomUUID();
    const body = JSON.stringify(payload);
    await client.query(
      `INSERT INTO app.audit_events
        (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tenantId, id, actorId, eventType, aggregateType, aggregateId, body]);
    await client.query(
      `INSERT INTO app.outbox_events
        (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [tenantId, id, eventType, aggregateType, aggregateId, body]);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
