import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type { ConfigureRiskPolicyInput } from './risk.schemas.js';

type PositionRow = {
  commodity: string;
  purchase_contracted_kg: string;
  purchase_commitment_amount: string;
  sales_contracted_kg: string;
  sales_commitment_amount: string;
  physical_stock_kg: string;
  committed_stock_kg: string;
  dispatched_kg: string;
  projected_receivable_amount: string;
  outstanding_receivable_amount: string;
  received_amount: string;
};

type PolicyRow = {
  id: string;
  commodity: string;
  version: number;
  max_net_open_kg: string;
  warning_threshold_pct: string;
};

@Injectable()
export class RiskService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  workspace(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await client.query<{
        legal_name: string; is_demo: boolean; demo_seed_version: number | null;
      }>('SELECT legal_name,is_demo,demo_seed_version FROM app.tenants WHERE id=$1', [tenantId]);
      const positions = await client.query<PositionRow>(
        `WITH commodities AS (
           SELECT commodity FROM app.offers WHERE tenant_id=$1 AND status='CONVERTED'
           UNION SELECT commodity FROM app.sales_contracts WHERE tenant_id=$1 AND status='ACTIVE'
           UNION SELECT commodity FROM app.inventory_lots WHERE tenant_id=$1
         ), purchases AS (
           SELECT o.commodity,
                  COALESCE(sum(o.quantity_sc*60),0)::numeric(20,3) AS contracted_kg,
                  COALESCE(sum(o.quantity_sc*ps.purchase_price_per_sc),0)::numeric(20,2) AS commitment_amount
             FROM app.contracts c
             JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
             JOIN app.pricing_scenarios ps
               ON (ps.tenant_id,ps.offer_id)=(o.tenant_id,o.id) AND ps.is_current=true
            WHERE c.tenant_id=$1 AND c.status='ACTIVE'
            GROUP BY o.commodity
         ), sales AS (
           SELECT commodity,
                  COALESCE(sum(quantity_kg),0)::numeric(20,3) AS contracted_kg,
                  COALESCE(sum(quantity_kg*sale_price_per_kg),0)::numeric(20,2) AS commitment_amount
             FROM app.sales_contracts WHERE tenant_id=$1 AND status='ACTIVE' GROUP BY commodity
         ), stock AS (
           SELECT lot.commodity,
                  COALESCE(sum(m.quantity_delta_kg),0)::numeric(20,3) AS physical_kg
             FROM app.inventory_lots lot
             LEFT JOIN app.inventory_movements m
               ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
            WHERE lot.tenant_id=$1 GROUP BY lot.commodity
         ), allocations AS (
           SELECT sc.commodity,
                  COALESCE(sum(a.quantity_kg-COALESCE(d.dispatched_kg,0)),0)::numeric(20,3) AS committed_kg,
                  COALESCE(sum(COALESCE(d.dispatched_kg,0)),0)::numeric(20,3) AS dispatched_kg
             FROM app.inventory_allocations a
             JOIN app.sales_contracts sc
               ON (sc.tenant_id,sc.id)=(a.tenant_id,a.sales_contract_id)
             LEFT JOIN LATERAL (
               SELECT sum(quantity_kg)::numeric(20,3) AS dispatched_kg
                 FROM app.inventory_dispatches
                WHERE tenant_id=a.tenant_id AND allocation_id=a.id
             ) d ON true
            WHERE a.tenant_id=$1 AND a.status='ACTIVE' GROUP BY sc.commodity
         ), finance AS (
           SELECT sc.commodity,
                  COALESCE(sum(fe.calculated_amount),0)::numeric(20,2) AS projected,
                  COALESCE(sum(ft.amount-COALESCE(st.settled,0)),0)::numeric(20,2) AS outstanding,
                  COALESCE(sum(COALESCE(st.settled,0)),0)::numeric(20,2) AS received
             FROM app.financial_events fe
             JOIN app.sales_contracts sc
               ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
             LEFT JOIN app.financial_titles ft
               ON (ft.tenant_id,ft.financial_event_id)=(fe.tenant_id,fe.id)
             LEFT JOIN LATERAL (
               SELECT sum(amount) FILTER (WHERE reversed_at IS NULL)::numeric(20,2) AS settled
                 FROM app.financial_settlements
                WHERE tenant_id=ft.tenant_id AND title_id=ft.id
             ) st ON true
            WHERE fe.tenant_id=$1 GROUP BY sc.commodity
         )
         SELECT c.commodity,
                COALESCE(p.contracted_kg,0)::text AS purchase_contracted_kg,
                COALESCE(p.commitment_amount,0)::text AS purchase_commitment_amount,
                COALESCE(s.contracted_kg,0)::text AS sales_contracted_kg,
                COALESCE(s.commitment_amount,0)::text AS sales_commitment_amount,
                COALESCE(st.physical_kg,0)::text AS physical_stock_kg,
                COALESCE(a.committed_kg,0)::text AS committed_stock_kg,
                COALESCE(a.dispatched_kg,0)::text AS dispatched_kg,
                COALESCE(f.projected,0)::text AS projected_receivable_amount,
                COALESCE(f.outstanding,0)::text AS outstanding_receivable_amount,
                COALESCE(f.received,0)::text AS received_amount
           FROM commodities c
           LEFT JOIN purchases p USING (commodity)
           LEFT JOIN sales s USING (commodity)
           LEFT JOIN stock st USING (commodity)
           LEFT JOIN allocations a USING (commodity)
           LEFT JOIN finance f USING (commodity)
          ORDER BY c.commodity`,
        [tenantId],
      );
      const policies = await client.query<PolicyRow>(
        `SELECT id,commodity,version,max_net_open_kg::text,warning_threshold_pct::text
           FROM app.risk_policies WHERE tenant_id=$1 AND active=true`, [tenantId]);
      const policyByCommodity = new Map(policies.rows.map((row) => [row.commodity, row]));
      const calculatedAt = new Date().toISOString();

      return {
        tenant: {
          legalName: tenant.rows[0]!.legal_name,
          isDemo: tenant.rows[0]!.is_demo,
          demoSeedVersion: tenant.rows[0]!.demo_seed_version,
        },
        calculatedAt,
        positions: positions.rows.map((row) => this.mapPosition(row, policyByCommodity.get(row.commodity))),
        marketRisk: {
          status: 'BLOCKED_CONFIGURATION',
          unavailableMetrics: ['MTM', 'P&L', 'PRICE_EXPOSURE', 'BASE_EXPOSURE', 'FX_EXPOSURE', 'VAR'],
          blockers: [
            'Fonte de preço, praça, instrumento e periodicidade ainda não homologados.',
            'Instrumentos de hedge e responsabilidade de execução ainda não configurados.',
          ],
        },
      };
    });
  }

  configurePolicy(tenantId: string, actorId: string, input: ConfigureRiskPolicyInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'RISK_MANAGE');
      const current = await client.query<PolicyRow>(
        `SELECT id,commodity,version,max_net_open_kg::text,warning_threshold_pct::text
           FROM app.risk_policies
          WHERE tenant_id=$1 AND commodity=$2 AND active=true FOR UPDATE`,
        [tenantId, input.commodity],
      );
      const id = randomUUID();
      const version = (current.rows[0]?.version ?? 0) + 1;
      await client.query(
        `UPDATE app.risk_policies SET active=false
          WHERE tenant_id=$1 AND commodity=$2 AND active=true`, [tenantId, input.commodity]);
      await client.query(
        `INSERT INTO app.risk_policies
          (tenant_id,id,commodity,version,max_net_open_kg,warning_threshold_pct,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [tenantId, id, input.commodity, version, input.maxNetOpenKg,
          input.warningThresholdPct, actorId],
      );
      await this.record(client, tenantId, actorId, 'risk.policy_configured', 'risk_policy', id, {
        commodity: input.commodity,
        version,
        maxNetOpenKg: input.maxNetOpenKg,
        warningThresholdPct: input.warningThresholdPct,
        replacedPolicyId: current.rows[0]?.id ?? null,
      });
      return { id, version, active: true, ...input };
    });
  }

  private mapPosition(row: PositionRow, policy?: PolicyRow) {
    const purchase = new Decimal(row.purchase_contracted_kg);
    const sales = new Decimal(row.sales_contracted_kg);
    const net = purchase.minus(sales);
    const physical = new Decimal(row.physical_stock_kg);
    const committed = new Decimal(row.committed_stock_kg);
    const available = Decimal.max(physical.minus(committed), 0);
    const covered = Decimal.min(new Decimal(row.committed_stock_kg).plus(row.dispatched_kg), sales);
    const coveragePct = sales.isZero() ? new Decimal(0) : covered.div(sales).mul(100);
    const usagePct = policy ? net.abs().div(policy.max_net_open_kg).mul(100) : null;
    const status = !policy ? 'UNCONFIGURED'
      : usagePct!.greaterThan(100) ? 'EXCEEDED'
      : usagePct!.greaterThanOrEqualTo(policy.warning_threshold_pct) ? 'WARNING'
      : 'WITHIN_LIMIT';

    return {
      commodity: row.commodity,
      physical: {
        purchaseContractedKg: purchase.toFixed(3), salesContractedKg: sales.toFixed(3),
        netContractualKg: net.toFixed(3), physicalStockKg: physical.toFixed(3),
        committedStockKg: committed.toFixed(3), availableStockKg: available.toFixed(3),
        dispatchedKg: new Decimal(row.dispatched_kg).toFixed(3),
        fulfillmentCoveragePct: coveragePct.toDecimalPlaces(2).toFixed(2),
      },
      financial: {
        purchaseCommitmentAmount: new Decimal(row.purchase_commitment_amount).toFixed(2),
        salesCommitmentAmount: new Decimal(row.sales_commitment_amount).toFixed(2),
        netContractedAmount: new Decimal(row.sales_commitment_amount)
          .minus(row.purchase_commitment_amount).toFixed(2),
        projectedReceivableAmount: new Decimal(row.projected_receivable_amount).toFixed(2),
        outstandingReceivableAmount: new Decimal(row.outstanding_receivable_amount).toFixed(2),
        receivedAmount: new Decimal(row.received_amount).toFixed(2),
      },
      limit: policy ? {
        id: policy.id, version: policy.version,
        maxNetOpenKg: new Decimal(policy.max_net_open_kg).toFixed(3),
        warningThresholdPct: new Decimal(policy.warning_threshold_pct).toFixed(2),
        usagePct: usagePct!.toDecimalPlaces(2).toFixed(2), status,
      } : { id: null, version: null, maxNetOpenKg: null, warningThresholdPct: null, usagePct: null, status },
    };
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
    const eventId = randomUUID();
    await client.query(
      `INSERT INTO app.audit_events
        (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tenantId, eventId, actorId, eventType, aggregateType, aggregateId, JSON.stringify(payload)],
    );
    await client.query(
      `INSERT INTO app.outbox_events
        (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [tenantId, eventId, eventType, aggregateType, aggregateId, JSON.stringify(payload)],
    );
  }
}
