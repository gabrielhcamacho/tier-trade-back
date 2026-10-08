import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { PoolClient, QueryResultRow } from 'pg';
import type { DashboardModuleName } from './dashboard.constants.js';

type SnapshotPayload = Record<string, unknown>;
interface SnapshotSections {
  indicators: Record<string, unknown>;
  breakdowns?: Record<string, unknown>;
  alerts?: unknown[];
  drilldowns?: Record<string, string>;
  unavailable?: string[];
}

@Injectable()
export class DashboardSnapshotBuilder {
  async build(client: PoolClient, tenantId: string, module: DashboardModuleName): Promise<SnapshotPayload> {
    const built: SnapshotSections = await this[module](client, tenantId);
    return {
      contractVersion: 1,
      module,
      scope: { key: 'default', filters: {} },
      indicators: built.indicators,
      breakdowns: built.breakdowns ?? {},
      alerts: built.alerts ?? [],
      drilldowns: built.drilldowns ?? {},
      unavailable: built.unavailable ?? [],
    };
  }

  private async central(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='IN_APPROVAL') AS pending_approvals,
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='ACTIVE') AS active_contracts,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status IN ('SCHEDULED','IN_RECEIVING')) AS active_loads,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN') AS open_occurrences,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN' AND severity='CRITICAL') AS critical_occurrences,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING') AS pending_obligations,
      (SELECT count(*)::int FROM app.financial_titles WHERE tenant_id=$1 AND status IN ('OPEN','PARTIALLY_SETTLED')) AS open_titles,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status IN ('RECEIVED','REJECTED')) AS fiscal_reviews`, tenantId);
    return {
      indicators: this.camel(row),
      drilldowns: {
        pendingApprovals: '/v1/offers',
        activeContracts: '/v1/contracts',
        activeLoads: '/v1/operations/receiving',
        openTitles: '/v1/finance',
      },
    };
  }

  private async commercial(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN') AS open_demands,
      (SELECT COALESCE(sum(quantity_sc),0)::text FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN') AS open_demand_quantity_sc,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='DRAFT') AS draft_offers,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='IN_APPROVAL') AS pending_approvals,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='APPROVED') AS approved_offers,
      (SELECT count(*)::int FROM app.commercial_negotiation_entries WHERE tenant_id=$1 AND created_at>=now()-interval '7 days') AS negotiations_last_7_days,
      (SELECT count(*)::int FROM app.counterparties WHERE tenant_id=$1) AS counterparties`, tenantId);
    const breakdown = await client.query<{ commodity: string; quantity_sc: string; demand_count: number }>(
      `SELECT commodity,sum(quantity_sc)::text AS quantity_sc,count(*)::int AS demand_count
         FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN'
        GROUP BY commodity ORDER BY commodity`, [tenantId]);
    return { indicators: this.camel(row), breakdowns: { openDemandByCommodity: breakdown.rows },
      drilldowns: { demands: '/v1/commercial/demands', offers: '/v1/offers' } };
  }

  private async contracts(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='ACTIVE') AS active_contracts,
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='CANCELLED') AS cancelled_contracts,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING') AS pending_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING' AND due_date<current_date) AS overdue_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING' AND due_date BETWEEN current_date AND current_date+30) AS obligations_due_30_days,
      (SELECT count(*)::int FROM app.contract_amendments WHERE tenant_id=$1) AS amendments,
      (SELECT count(*)::int FROM app.documents WHERE tenant_id=$1 AND aggregate_type='CONTRACT' AND status='PENDING_UPLOAD') AS pending_documents`, tenantId);
    return { indicators: this.camel(row), drilldowns: { contracts: '/v1/contracts' } };
  }

  private async operations(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='SCHEDULED') AS scheduled_loads,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='IN_RECEIVING') AS loads_in_receiving,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='RECEIVED') AS received_loads,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='SCHEDULED' AND scheduled_at<now()) AS delayed_loads,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN') AS open_occurrences,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN' AND severity='CRITICAL') AS critical_occurrences,
      (SELECT count(*)::int FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true AND quality_decision='REVIEW_REQUIRED') AS quality_reviews,
      (SELECT COALESCE(sum(net_weight_kg),0)::text FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true) AS received_weight_kg`, tenantId);
    return { indicators: this.camel(row), drilldowns: {
      yard: '/v1/operations/yard', receiving: '/v1/operations/receiving',
      occurrences: '/v1/operations/occurrences', quality: '/v1/operations/quality',
    } };
  }

  private async inventory(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.inventory_locations WHERE tenant_id=$1 AND status='ACTIVE') AS active_locations,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND status='AVAILABLE') AS available_lots,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND status='BLOCKED_REVIEW') AS blocked_lots,
      (SELECT count(*)::int FROM app.inventory_transfers WHERE tenant_id=$1 AND status='IN_TRANSIT') AS transfers_in_transit,
      (SELECT COALESCE(sum(quantity_delta_kg),0)::text FROM app.inventory_movements WHERE tenant_id=$1) AS physical_quantity_kg,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND ownership_status='PENDING_DEFINITION') AS ownership_pending,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND risk_status='PENDING_DEFINITION') AS risk_classification_pending`, tenantId);
    const breakdown = await client.query<{ commodity: string; quantity_kg: string }>(
      `SELECT lot.commodity,COALESCE(sum(m.quantity_delta_kg),0)::text AS quantity_kg
         FROM app.inventory_lots lot
         LEFT JOIN app.inventory_movements m ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
        WHERE lot.tenant_id=$1 GROUP BY lot.commodity ORDER BY lot.commodity`, [tenantId]);
    return { indicators: this.camel(row), breakdowns: { physicalByCommodity: breakdown.rows },
      drilldowns: { position: '/v1/inventory' } };
  }

  private async risk(client: PoolClient, tenantId: string) {
    const positions = await client.query<{
      commodity: string; purchase_kg: string; sales_kg: string; net_open_kg: string;
      max_net_open_kg: string | null; warning_threshold_pct: string | null;
    }>(`WITH commodities AS (
          SELECT commodity FROM app.offers WHERE tenant_id=$1 AND status='CONVERTED'
          UNION SELECT commodity FROM app.sales_contracts WHERE tenant_id=$1 AND status='ACTIVE'
        ), purchases AS (
          SELECT o.commodity,COALESCE(sum(o.quantity_sc*60),0) AS quantity_kg
            FROM app.contracts c JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           WHERE c.tenant_id=$1 AND c.status='ACTIVE' GROUP BY o.commodity
        ), sales AS (
          SELECT commodity,COALESCE(sum(quantity_kg),0) AS quantity_kg
            FROM app.sales_contracts WHERE tenant_id=$1 AND status='ACTIVE' GROUP BY commodity
        )
        SELECT c.commodity,COALESCE(p.quantity_kg,0)::text AS purchase_kg,
               COALESCE(s.quantity_kg,0)::text AS sales_kg,
               abs(COALESCE(p.quantity_kg,0)-COALESCE(s.quantity_kg,0))::text AS net_open_kg,
               rp.max_net_open_kg::text,rp.warning_threshold_pct::text
          FROM commodities c LEFT JOIN purchases p USING (commodity) LEFT JOIN sales s USING (commodity)
          LEFT JOIN app.risk_policies rp ON rp.tenant_id=$1 AND rp.commodity=c.commodity AND rp.active=true
         ORDER BY c.commodity`, [tenantId]);
    const mapped = positions.rows.map((position) => {
      const net = new Decimal(position.net_open_kg);
      const limit = position.max_net_open_kg ? new Decimal(position.max_net_open_kg) : null;
      const warning = limit && position.warning_threshold_pct
        ? limit.times(position.warning_threshold_pct).div(100) : null;
      const status = !limit ? 'UNCONFIGURED' : net.gt(limit) ? 'EXCEEDED' : warning && net.gte(warning) ? 'WARNING' : 'OK';
      return { ...position, status };
    });
    return { indicators: {
      commodityCount: mapped.length,
      warningCount: mapped.filter((item) => item.status === 'WARNING').length,
      exceededCount: mapped.filter((item) => item.status === 'EXCEEDED').length,
      unconfiguredCount: mapped.filter((item) => item.status === 'UNCONFIGURED').length,
    }, breakdowns: { positions: mapped }, drilldowns: { workspace: '/v1/risk' },
    unavailable: ['MTM', 'P&L', 'PRICE_EXPOSURE', 'BASE_EXPOSURE', 'FX_EXPOSURE', 'VAR'] };
  }

  private async financial(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `WITH balances AS (
      SELECT fe.direction,ft.due_date,
             GREATEST(ft.amount-COALESCE(st.amount,0)-COALESCE(pm.amount,0)-COALESCE(adj.amount,0),0) AS outstanding
        FROM app.financial_titles ft
        JOIN app.financial_events fe ON (fe.tenant_id,fe.id)=(ft.tenant_id,ft.financial_event_id)
        LEFT JOIN LATERAL (SELECT sum(amount) FILTER (WHERE reversed_at IS NULL) AS amount
          FROM app.financial_settlements WHERE tenant_id=ft.tenant_id AND title_id=ft.id) st ON true
        LEFT JOIN LATERAL (SELECT sum(amount) FILTER (WHERE reversed_at IS NULL) AS amount
          FROM app.financial_payments WHERE tenant_id=ft.tenant_id AND title_id=ft.id) pm ON true
        LEFT JOIN LATERAL (SELECT sum(CASE WHEN adjustment_effect='INCREASE' THEN -amount ELSE amount END)
          FILTER (WHERE reversed_at IS NULL) AS amount FROM app.financial_title_adjustments
          WHERE tenant_id=ft.tenant_id AND title_id=ft.id) adj ON true
       WHERE ft.tenant_id=$1 AND ft.status IN ('OPEN','PARTIALLY_SETTLED')
    ) SELECT
      COALESCE(sum(outstanding) FILTER (WHERE direction='INFLOW'),0)::text AS receivable_amount,
      COALESCE(sum(outstanding) FILTER (WHERE direction='OUTFLOW'),0)::text AS payable_amount,
      count(*) FILTER (WHERE due_date<current_date AND outstanding>0)::int AS overdue_titles,
      (SELECT count(*)::int FROM app.financial_events WHERE tenant_id=$1 AND calculation_status='PENDING_ROUNDING_POLICY') AS pending_rounding,
      (SELECT count(*)::int FROM app.payment_batches WHERE tenant_id=$1 AND status='PENDING_APPROVAL') AS payment_batches_pending_approval,
      (SELECT count(*)::int FROM app.bank_statement_entries WHERE tenant_id=$1 AND status='UNMATCHED') AS unmatched_bank_entries,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_settlements WHERE tenant_id=$1) AS received_amount,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_payments WHERE tenant_id=$1) AS paid_amount
      FROM balances`, tenantId);
    return { indicators: this.camel(row), drilldowns: { workspace: '/v1/finance' } };
  }

  private async fiscal(client: PoolClient, tenantId: string) {
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='RECEIVED') AS documents_pending_validation,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='VALIDATED') AS validated_documents,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='REJECTED') AS rejected_documents,
      (SELECT count(*)::int FROM app.fiscal_configuration_versions WHERE tenant_id=$1 AND status='ACTIVE') AS active_configurations,
      (SELECT count(*)::int FROM app.fiscal_calculations WHERE tenant_id=$1 AND status='CALCULATED') AS calculations_pending_acceptance,
      (SELECT count(*)::int FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN') AS open_obligations,
      (SELECT count(*)::int FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN' AND due_date<current_date) AS overdue_obligations,
      (SELECT COALESCE(sum(amount),0)::text FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN') AS open_obligation_amount`, tenantId);
    return { indicators: this.camel(row), drilldowns: { workspace: '/v1/fiscal' } };
  }

  private async one(client: PoolClient, sql: string, tenantId: string): Promise<QueryResultRow> {
    const result = await client.query(sql, [tenantId]);
    return result.rows[0] ?? {};
  }

  private camel(row: QueryResultRow): QueryResultRow {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value,
    ]));
  }
}
