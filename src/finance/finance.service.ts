import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import {
  FinancialProjectionPort, type ApplyFiscalObligationInput, type ProjectSalesDispatchInput,
} from './finance.port.js';
import type { CreateTitleInput, ReverseSettlementInput, SettleTitleInput } from './finance.schemas.js';

type FinancialEventRow = {
  id: string;
  event_type: string;
  direction: 'INFLOW' | 'OUTFLOW';
  source_id: string;
  sales_contract_id: string | null;
  contract_reference: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  authority_id: string | null;
  authority_name: string | null;
  document_reference: string | null;
  dispatched_at: Date | null;
  quantity_kg: string | null;
  unit_price: string | null;
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
  adjusted_amount: string;
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
        `SELECT fe.id,fe.event_type,fe.direction,fe.source_id,fe.sales_contract_id,
                sc.reference AS contract_reference,fe.counterparty_id,cp.legal_name AS counterparty_name,
                fe.fiscal_authority_id AS authority_id,fa.legal_name AS authority_name,
                d.document_reference,d.dispatched_at,
                fe.quantity_kg::text,fe.unit_price::text,fe.raw_amount::text,fe.calculated_amount::text,
                fe.calculation_status,fe.expected_on::text,fe.formula_code,fe.formula_version,
                fe.calculation_memory,ft.id AS title_id,ft.title_number,
                ft.document_reference AS title_document_reference,ft.due_date::text,
                ft.amount::text AS title_amount,ft.status AS title_status,
                COALESCE(st.settled_amount,0)::text AS settled_amount,
                COALESCE(adj.adjusted_amount,0)::text AS adjusted_amount
           FROM app.financial_events fe
           LEFT JOIN app.sales_contracts sc
             ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
           LEFT JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(fe.tenant_id,fe.counterparty_id)
           LEFT JOIN app.fiscal_authorities fa
             ON (fa.tenant_id,fa.id)=(fe.tenant_id,fe.fiscal_authority_id)
           LEFT JOIN app.inventory_dispatches d
             ON (d.tenant_id,d.id)=(fe.tenant_id,fe.inventory_dispatch_id)
           LEFT JOIN app.financial_titles ft
             ON (ft.tenant_id,ft.financial_event_id)=(fe.tenant_id,fe.id)
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(fs.amount) FILTER (WHERE fs.reversed_at IS NULL),0)::numeric(20,2) AS settled_amount
               FROM app.financial_settlements fs
              WHERE fs.tenant_id=ft.tenant_id AND fs.title_id=ft.id
           ) st ON true
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(fta.amount),0)::numeric(20,2) AS adjusted_amount
               FROM app.financial_title_adjustments fta
              WHERE fta.tenant_id=ft.tenant_id AND fta.title_id=ft.id
           ) adj ON true
          WHERE fe.tenant_id=$1
          ORDER BY fe.created_at DESC,fe.id DESC`, [tenantId]);
      const settlements = await client.query<SettlementRow>(
        `SELECT fs.id,fs.title_id,ft.title_number,fs.amount::text,fs.received_at,
                fs.bank_reference,fs.notes,fs.reversed_at,fs.reversal_reason
           FROM app.financial_settlements fs
           JOIN app.financial_titles ft ON (ft.tenant_id,ft.id)=(fs.tenant_id,fs.title_id)
          WHERE fs.tenant_id=$1 ORDER BY fs.received_at DESC,fs.id DESC`, [tenantId]);

      const projected = events.rows.filter((row) => row.direction === 'INFLOW').reduce((sum, row) =>
        sum.plus(row.calculated_amount ?? 0), new Decimal(0));
      const outstanding = (row: FinancialEventRow) => row.title_amount
        ? Decimal.max(new Decimal(row.title_amount).minus(row.adjusted_amount).minus(row.settled_amount), 0)
        : new Decimal(0);
      const receivable = events.rows.filter((row) => row.direction === 'INFLOW')
        .reduce((sum, row) => sum.plus(outstanding(row)), new Decimal(0));
      const payable = events.rows.filter((row) => row.direction === 'OUTFLOW')
        .reduce((sum, row) => sum.plus(outstanding(row)), new Decimal(0));
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
          payableAmount: payable.toFixed(2),
          pendingForecastCount: events.rows.filter(
            (row) => !row.title_id && row.calculation_status === 'READY').length,
          pendingRoundingCount: events.rows.filter(
            (row) => row.calculation_status === 'PENDING_ROUNDING_POLICY').length,
        },
        events: events.rows.map((row) => ({
          id: row.id,
          eventType: row.event_type,
          direction: row.direction,
          sourceId: row.source_id,
          salesContractId: row.sales_contract_id,
          contractReference: row.contract_reference,
          counterpartyId: row.counterparty_id,
          counterpartyName: row.counterparty_name,
          authorityId: row.authority_id,
          authorityName: row.authority_name,
          beneficiaryType: row.authority_id ? 'FISCAL_AUTHORITY' : 'COUNTERPARTY',
          beneficiaryName: row.authority_name ?? row.counterparty_name,
          dispatchDocumentReference: row.document_reference,
          dispatchedAt: row.dispatched_at?.toISOString() ?? null,
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
            adjustedAmount: row.adjusted_amount,
            outstandingAmount: outstanding(row).toFixed(2),
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
      const title = await client.query<{ amount: string; direction: string }>(
        `SELECT ft.amount::text,fe.direction
           FROM app.financial_titles ft
           JOIN app.financial_events fe
             ON (fe.tenant_id,fe.id)=(ft.tenant_id,ft.financial_event_id)
          WHERE ft.tenant_id=$1 AND ft.id=$2 FOR UPDATE OF ft`,
        [tenantId, titleId]);
      if (!title.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_TITLE_NOT_FOUND' });
      if (title.rows[0].direction !== 'INFLOW') {
        throw new ConflictException({ code: 'PAYABLE_SETTLEMENT_FLOW_NOT_AVAILABLE' });
      }
      const balance = await client.query<{ paid: string; adjusted: string }>(
        `SELECT
           COALESCE((SELECT sum(amount) FROM app.financial_settlements
             WHERE tenant_id=$1 AND title_id=$2 AND reversed_at IS NULL),0)::text AS paid,
           COALESCE((SELECT sum(amount) FROM app.financial_title_adjustments
             WHERE tenant_id=$1 AND title_id=$2),0)::text AS adjusted`, [tenantId, titleId]);
      const amount = new Decimal(input.amount);
      const remaining = new Decimal(title.rows[0].amount)
        .minus(balance.rows[0]!.adjusted).minus(balance.rows[0]!.paid);
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
      const balance = await client.query<{ amount: string; settled: string; adjusted: string }>(
        `SELECT ft.amount::text,
                COALESCE(sum(fs.amount) FILTER (WHERE fs.reversed_at IS NULL),0)::text AS settled,
                COALESCE((SELECT sum(fta.amount) FROM app.financial_title_adjustments fta
                  WHERE fta.tenant_id=ft.tenant_id AND fta.title_id=ft.id),0)::text AS adjusted
           FROM app.financial_titles ft
           LEFT JOIN app.financial_settlements fs
             ON (fs.tenant_id,fs.title_id)=(ft.tenant_id,ft.id)
          WHERE ft.tenant_id=$1 AND ft.id=$2 GROUP BY ft.tenant_id,ft.id,ft.amount`, [tenantId, titleId]);
      const settled = new Decimal(balance.rows[0]!.settled);
      const payable = new Decimal(balance.rows[0]!.amount).minus(balance.rows[0]!.adjusted);
      const status = settled.isZero()
        ? 'OPEN' : settled.equals(payable) ? 'SETTLED' : 'PARTIALLY_SETTLED';
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
         inventory_dispatch_id,direction,quantity_kg,unit_price,raw_amount,calculated_amount,calculation_status,
         expected_on,formula_code,formula_version,calculation_memory,created_by)
       VALUES ($1,$2,'SALE_DISPATCH_RECEIVABLE','INVENTORY_DISPATCH',$3,$4,$5,$3,'INFLOW',
         $6,$7,$8,$9,$10,$11,'SALE_DISPATCH_GROSS',1,$12::jsonb,$13)`,
      [input.tenantId, id, input.dispatchId, row.sales_contract_id, row.counterparty_id,
        new Decimal(row.quantity_kg).toFixed(3), new Decimal(row.sale_price_per_kg).toFixed(6),
        raw.toFixed(9), exactCents ? raw.toFixed(2) : null, calculationStatus,
        row.expected_on, JSON.stringify(memory), input.actorId]);
    await this.record(client, input.tenantId, input.actorId, 'finance.forecast_projected',
      'financial_event', id, memory);
    return { financialEventId: id, calculationStatus };
  }

  async applyFiscalObligation(client: PoolClient, input: ApplyFiscalObligationInput) {
    let adjustmentId: string | null = null;
    if (input.titleEffect === 'REDUCE_SOURCE_TITLE') {
      if (!input.sourceFinancialEventId) {
        throw new ConflictException({ code: 'FISCAL_SOURCE_TITLE_REQUIRED' });
      }
      const sourceTitle = await client.query<{
        id: string; amount: string; adjusted: string; settled: string;
      }>(
        `SELECT ft.id,ft.amount::text,COALESCE(adj.adjusted,0)::text AS adjusted,
                COALESCE(paid.settled,0)::text AS settled
           FROM app.financial_titles ft
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(fta.amount),0)::numeric(20,2) AS adjusted
               FROM app.financial_title_adjustments fta
              WHERE fta.tenant_id=ft.tenant_id AND fta.title_id=ft.id
           ) adj ON true
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(fs.amount) FILTER (WHERE fs.reversed_at IS NULL),0)::numeric(20,2) AS settled
               FROM app.financial_settlements fs
              WHERE fs.tenant_id=ft.tenant_id AND fs.title_id=ft.id
           ) paid ON true
          WHERE ft.tenant_id=$1 AND ft.financial_event_id=$2
          FOR UPDATE OF ft`,
        [input.tenantId, input.sourceFinancialEventId],
      );
      if (!sourceTitle.rows[0]) throw new ConflictException({ code: 'FISCAL_SOURCE_TITLE_REQUIRED' });
      const available = new Decimal(sourceTitle.rows[0].amount)
        .minus(sourceTitle.rows[0].adjusted).minus(sourceTitle.rows[0].settled);
      if (new Decimal(input.amount).greaterThan(available)) {
        throw new UnprocessableEntityException({ code: 'FISCAL_RETENTION_EXCEEDS_SOURCE_TITLE' });
      }
      adjustmentId = randomUUID();
      await client.query(
        `INSERT INTO app.financial_title_adjustments
          (tenant_id,id,title_id,financial_event_id,fiscal_obligation_id,
           adjustment_type,amount,created_by)
         VALUES ($1,$2,$3,$4,$5,'FISCAL_RETENTION',$6,$7)`,
        [input.tenantId, adjustmentId, sourceTitle.rows[0].id, input.sourceFinancialEventId,
          input.obligationId, new Decimal(input.amount).toFixed(2), input.actorId],
      );
      const remainingAfterAdjustment = available.minus(input.amount);
      const adjustedStatus = remainingAfterAdjustment.isZero()
        ? 'SETTLED'
        : new Decimal(sourceTitle.rows[0].settled).greaterThan(0) ? 'PARTIALLY_SETTLED' : 'OPEN';
      await client.query(
        'UPDATE app.financial_titles SET status=$3 WHERE tenant_id=$1 AND id=$2',
        [input.tenantId, sourceTitle.rows[0].id, adjustedStatus],
      );
      await this.record(client, input.tenantId, input.actorId, 'finance.title_adjusted',
        'financial_title_adjustment', adjustmentId, {
          titleId: sourceTitle.rows[0].id, fiscalObligationId: input.obligationId,
          amount: new Decimal(input.amount).toFixed(2), adjustmentType: 'FISCAL_RETENTION',
        });
    }

    let payableEventId: string | null = null;
    let payableTitleId: string | null = null;
    if (input.paymentResponsibility === 'TENANT') {
      if (!input.titleNumber || !input.documentReference) {
        throw new ConflictException({ code: 'FISCAL_PAYABLE_IDENTIFICATION_REQUIRED' });
      }
      payableEventId = randomUUID();
      const amount = new Decimal(input.amount).toFixed(2);
      const memory = {
        fiscalObligationId: input.obligationId, tax: input.tax, authorityId: input.authorityId,
        authorityName: input.authorityName, competenceDate: input.competenceDate,
        dueDate: input.dueDate, amount, currency: 'BRL',
      };
      await client.query(
        `INSERT INTO app.financial_events
          (tenant_id,id,event_type,source_type,source_id,fiscal_obligation_id,fiscal_authority_id,
           direction,currency,raw_amount,calculated_amount,calculation_status,expected_on,
           formula_code,formula_version,calculation_memory,created_by)
         VALUES ($1,$2,'TAX_OBLIGATION_PAYABLE','FISCAL_OBLIGATION',$3,$3,$4,
           'OUTFLOW','BRL',$5,$5,'READY',$6,'FISCAL_OBLIGATION_CONFIRMED',1,$7::jsonb,$8)`,
        [input.tenantId, payableEventId, input.obligationId, input.authorityId, amount,
          input.dueDate, JSON.stringify(memory), input.actorId],
      );
      payableTitleId = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.financial_titles
            (tenant_id,id,financial_event_id,title_number,document_reference,due_date,amount,issued_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [input.tenantId, payableTitleId, payableEventId, input.titleNumber,
            input.documentReference, input.dueDate, amount, input.actorId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({ code: 'FISCAL_PAYABLE_TITLE_ALREADY_EXISTS' });
        }
        throw error;
      }
      await this.record(client, input.tenantId, input.actorId, 'finance.tax_payable_projected',
        'financial_event', payableEventId, memory);
    }
    return { payableEventId, payableTitleId, adjustmentId };
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
