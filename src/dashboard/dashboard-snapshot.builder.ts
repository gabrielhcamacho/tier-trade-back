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

const DASHBOARD_TIMEZONE = 'America/Sao_Paulo';

/** Calendar used by every time bucket in a snapshot. */
interface Clock { tenantId: string; today: string; timezone: string }

// Outstanding balance of every open title. Shared by the central and financial
// snapshots so both read the same receivable/payable figures.
const OPEN_BALANCES = `balances AS (
      SELECT fe.direction,ft.due_date,fe.counterparty_id,
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
    )`;

// Active purchase contracts with their physical execution. Received weight
// follows the contract workspace: current receipts of loads already received.
const ACTIVE_PURCHASES = `purchases AS (
      SELECT c.id AS contract_id,o.commodity,o.counterparty_id,o.quantity_sc,o.delivery_start,o.delivery_end,
             s.projected_margin_per_sc,pct.external_number,
             COALESCE(lt.received_kg,0) AS received_kg,COALESCE(lt.scheduled_kg,0) AS scheduled_kg
        FROM app.contracts c
        JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
        LEFT JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
        LEFT JOIN app.purchase_contract_terms pct ON (pct.tenant_id,pct.contract_id)=(c.tenant_id,c.id)
        LEFT JOIN LATERAL (
          SELECT sum(r.net_weight_kg) FILTER (WHERE l.status='RECEIVED') AS received_kg,
                 sum(l.expected_weight_kg) FILTER (WHERE l.status IN ('SCHEDULED','IN_RECEIVING')) AS scheduled_kg
            FROM app.loads l
            LEFT JOIN app.load_receipts r ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
           WHERE l.tenant_id=c.tenant_id AND l.contract_id=c.id AND l.status<>'CANCELLED'
        ) lt ON true
       WHERE c.tenant_id=$1 AND c.status='ACTIVE'
    )`;

const ACTIVE_SALES = `sales AS (
      SELECT sc.id,sc.commodity,sc.quantity_kg,sc.delivery_end,COALESCE(d.kg,0) AS dispatched_kg
        FROM app.sales_contracts sc
        LEFT JOIN LATERAL (
          SELECT sum(dispatch.quantity_kg) AS kg
            FROM app.inventory_allocations allocation
            JOIN app.inventory_dispatches dispatch
              ON (dispatch.tenant_id,dispatch.allocation_id)=(allocation.tenant_id,allocation.id)
           WHERE allocation.tenant_id=sc.tenant_id AND allocation.sales_contract_id=sc.id
        ) d ON true
       WHERE sc.tenant_id=$1 AND sc.status='ACTIVE'
    )`;

@Injectable()
export class DashboardSnapshotBuilder {
  async build(client: PoolClient, tenantId: string, module: DashboardModuleName): Promise<SnapshotPayload> {
    const clock = await this.clock(client, tenantId);
    const built: SnapshotSections = await this[module](client, clock);
    return {
      contractVersion: 1,
      module,
      scope: { key: 'default', filters: {} },
      calendar: { today: clock.today, timezone: clock.timezone },
      indicators: built.indicators,
      breakdowns: built.breakdowns ?? {},
      alerts: built.alerts ?? [],
      drilldowns: built.drilldowns ?? {},
      unavailable: built.unavailable ?? [],
    };
  }

  private async central(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='IN_APPROVAL') AS pending_approvals,
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='ACTIVE') AS active_contracts,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status IN ('SCHEDULED','IN_RECEIVING')) AS active_loads,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN') AS open_occurrences,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN' AND severity='CRITICAL') AS critical_occurrences,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING') AS pending_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status IN ('PENDING','IN_PROGRESS')) AS open_obligations,
      (SELECT count(*)::int FROM app.financial_titles WHERE tenant_id=$1 AND status IN ('OPEN','PARTIALLY_SETTLED')) AS open_titles,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status IN ('RECEIVED','REJECTED')) AS fiscal_reviews,
      (SELECT count(*)::int FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true AND quality_decision='REVIEW_REQUIRED') AS quality_reviews,
      (SELECT count(*)::int FROM app.payment_batches WHERE tenant_id=$1 AND status='PENDING_APPROVAL') AS payment_batches_pending_approval,
      (SELECT count(*)::int FROM app.bank_statement_entries WHERE tenant_id=$1 AND status='UNMATCHED') AS unmatched_bank_entries`, tenantId);
    const balances = await this.one(client, `WITH ${OPEN_BALANCES}
      SELECT COALESCE(sum(outstanding) FILTER (WHERE direction='INFLOW'),0)::text AS receivable_amount,
             COALESCE(sum(outstanding) FILTER (WHERE direction='OUTFLOW'),0)::text AS payable_amount
        FROM balances`, tenantId);
    const totals = await this.one(client, `WITH ${ACTIVE_PURCHASES}
      SELECT COALESCE(sum(quantity_sc*projected_margin_per_sc),0)::text AS projected_margin_amount,
             COALESCE(sum(quantity_sc*60),0)::text AS purchase_contracted_kg,
             COALESCE(sum(received_kg),0)::text AS purchase_received_kg
        FROM purchases`, tenantId);
    const risk = await this.risk(client, clock);
    return {
      indicators: {
        ...this.camel(row), ...this.camel(balances), ...this.camel(totals),
        riskAttention: Number(risk.indicators.warningCount) + Number(risk.indicators.exceededCount),
      },
      breakdowns: {
        flowByCommodity: await this.flowByCommodity(client, clock),
        dueByWeek: await this.dueByWeek(client, clock),
        marginByContract: await this.marginByContract(client, clock),
      },
      drilldowns: {
        pendingApprovals: '/v1/offers',
        activeContracts: '/v1/contracts',
        activeLoads: '/v1/operations/receiving',
        openTitles: '/v1/finance',
      },
    };
  }

  private async commercial(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN') AS open_demands,
      (SELECT COALESCE(sum(quantity_sc),0)::text FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN') AS open_demand_quantity_sc,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='DRAFT') AS draft_offers,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='IN_APPROVAL') AS pending_approvals,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='APPROVED') AS approved_offers,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status IN ('DRAFT','IN_APPROVAL','APPROVED')) AS open_offers,
      (SELECT COALESCE(sum(quantity_sc),0)::text FROM app.offers WHERE tenant_id=$1 AND status IN ('DRAFT','IN_APPROVAL','APPROVED')) AS open_offer_quantity_sc,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status='CONVERTED' AND created_at>=now()-interval '90 days') AS converted_last_90_days,
      (SELECT count(*)::int FROM app.offers WHERE tenant_id=$1 AND status IN ('CONVERTED','CANCELLED') AND created_at>=now()-interval '90 days') AS decided_last_90_days,
      (SELECT count(*)::int FROM app.commercial_negotiation_entries WHERE tenant_id=$1 AND created_at>=now()-interval '7 days') AS negotiations_last_7_days,
      (SELECT count(*)::int FROM app.counterparties WHERE tenant_id=$1) AS counterparties`, tenantId);
    const margin = await this.one(client, `SELECT
        CASE WHEN sum(o.quantity_sc)>0 THEN (sum(o.quantity_sc*s.projected_margin_per_sc)/sum(o.quantity_sc))::text END
          AS average_margin_per_sc
        FROM app.offers o
        JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
       WHERE o.tenant_id=$1 AND o.status IN ('IN_APPROVAL','APPROVED','CONVERTED')
         AND o.created_at>=now()-interval '90 days'`, tenantId);
    const demand = await this.rows(client, `SELECT commodity,sum(quantity_sc)::text AS quantity_sc,count(*)::int AS demand_count,
             COALESCE(sum(quantity_sc) FILTER (WHERE direction='PURCHASE'),0)::text AS purchase_sc,
             COALESCE(sum(quantity_sc) FILTER (WHERE direction='SALE'),0)::text AS sale_sc
        FROM app.commercial_demands WHERE tenant_id=$1 AND status='OPEN'
       GROUP BY commodity ORDER BY sum(quantity_sc) DESC`, [tenantId]);
    const funnel = await this.rows(client, `SELECT stage.status,COALESCE(count(o.id),0)::int AS offers,
             COALESCE(sum(o.quantity_sc),0)::text AS quantity_sc
        FROM unnest(ARRAY['DRAFT','IN_APPROVAL','APPROVED','CONVERTED','CANCELLED']) WITH ORDINALITY AS stage(status,position)
        LEFT JOIN app.offers o ON o.tenant_id=$1 AND o.status=stage.status AND o.created_at>=now()-interval '90 days'
       GROUP BY stage.status,stage.position ORDER BY stage.position`, [tenantId]);
    const activity = await this.rows(client, `WITH weeks AS (
        SELECT date_trunc('week',$2::date)::date - 7*g AS week FROM generate_series(0,11) g
      )
      SELECT w.week::text,
        (SELECT count(*)::int FROM app.offers o WHERE o.tenant_id=$1
           AND (o.created_at AT TIME ZONE $3)::date >= w.week AND (o.created_at AT TIME ZONE $3)::date < w.week+7) AS offers,
        (SELECT count(*)::int FROM app.commercial_demands d WHERE d.tenant_id=$1
           AND (d.created_at AT TIME ZONE $3)::date >= w.week AND (d.created_at AT TIME ZONE $3)::date < w.week+7) AS demands,
        (SELECT count(*)::int FROM app.commercial_negotiation_entries n WHERE n.tenant_id=$1
           AND (n.created_at AT TIME ZONE $3)::date >= w.week AND (n.created_at AT TIME ZONE $3)::date < w.week+7) AS negotiations
        FROM weeks w ORDER BY w.week`, [tenantId, clock.today, clock.timezone]);
    const priceBridge = await this.rows(client, `SELECT o.commodity,sum(o.quantity_sc)::text AS quantity_sc,count(*)::int AS offers,
             (sum(o.quantity_sc*s.sale_reference_per_sc)/sum(o.quantity_sc))::text AS sale_reference_per_sc,
             (sum(o.quantity_sc*s.purchase_price_per_sc)/sum(o.quantity_sc))::text AS purchase_price_per_sc,
             (sum(o.quantity_sc*s.total_costs_per_sc)/sum(o.quantity_sc))::text AS total_costs_per_sc,
             (sum(o.quantity_sc*s.projected_margin_per_sc)/sum(o.quantity_sc))::text AS margin_per_sc
        FROM app.offers o
        JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
       WHERE o.tenant_id=$1 AND o.status<>'CANCELLED' AND o.created_at>=now()-interval '180 days'
         AND o.quantity_sc>0
       GROUP BY o.commodity ORDER BY sum(o.quantity_sc) DESC`, [tenantId]);
    const counterparties = await this.rows(client, `SELECT cp.id,cp.legal_name AS name,
             count(o.id)::int AS offers,
             count(o.id) FILTER (WHERE o.status='CONVERTED')::int AS converted,
             COALESCE(sum(o.quantity_sc),0)::text AS quantity_sc
        FROM app.offers o JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
       WHERE o.tenant_id=$1 AND o.status<>'CANCELLED' AND o.created_at>=now()-interval '180 days'
       GROUP BY cp.id,cp.legal_name ORDER BY sum(o.quantity_sc) DESC NULLS LAST LIMIT 6`, [tenantId]);
    return {
      indicators: { ...this.camel(row), ...this.camel(margin) },
      breakdowns: {
        openDemandByCommodity: demand, offerFunnel: funnel, activityByWeek: activity,
        priceBridgeByCommodity: priceBridge, topCounterparties: counterparties,
      },
      drilldowns: { demands: '/v1/commercial/demands', offers: '/v1/offers' },
    };
  }

  private async contracts(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='ACTIVE') AS active_contracts,
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status='CANCELLED') AS cancelled_contracts,
      (SELECT count(*)::int FROM app.contracts WHERE tenant_id=$1 AND status IN ('DRAFT','AWAITING_SIGNATURE','SIGNED')) AS contracts_in_formalization,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status='PENDING') AS pending_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status IN ('PENDING','IN_PROGRESS')) AS open_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status IN ('PENDING','IN_PROGRESS') AND due_date<$2::date) AS overdue_obligations,
      (SELECT count(*)::int FROM app.contract_obligations WHERE tenant_id=$1 AND status IN ('PENDING','IN_PROGRESS') AND due_date BETWEEN $2::date AND $2::date+30) AS obligations_due_30_days,
      (SELECT count(*)::int FROM app.contract_amendments WHERE tenant_id=$1) AS amendments,
      (SELECT count(*)::int FROM app.documents WHERE tenant_id=$1 AND aggregate_type='CONTRACT' AND status='PENDING_UPLOAD') AS pending_documents,
      (SELECT count(*)::int FROM app.document_signatures ds JOIN app.documents d ON (d.tenant_id,d.id)=(ds.tenant_id,ds.document_id)
        WHERE ds.tenant_id=$1 AND d.aggregate_type='CONTRACT' AND ds.status IN ('PENDING','SENT')) AS pending_signatures`,
      tenantId, [clock.today]);
    const totals = await this.one(client, `WITH ${ACTIVE_PURCHASES}
      SELECT COALESCE(sum(quantity_sc*projected_margin_per_sc),0)::text AS projected_margin_amount,
             COALESCE(sum(quantity_sc*60),0)::text AS contracted_kg,
             COALESCE(sum(received_kg),0)::text AS received_kg,
             COALESCE(sum(scheduled_kg),0)::text AS scheduled_kg
        FROM purchases`, tenantId);
    const statusMix = await this.rows(client, `SELECT stage.status,count(c.id)::int AS contracts
        FROM unnest(ARRAY['DRAFT','AWAITING_SIGNATURE','SIGNED','ACTIVE','CLOSED','CANCELLED']) WITH ORDINALITY AS stage(status,position)
        LEFT JOIN app.contracts c ON c.tenant_id=$1 AND c.status=stage.status
       GROUP BY stage.status,stage.position ORDER BY stage.position`, [tenantId]);
    const aging = await this.rows(client, `SELECT bucket.key,count(ob.id)::int AS obligations
        FROM unnest(ARRAY['OVERDUE_30','OVERDUE','NEXT_7','NEXT_30','NEXT_90','LATER','NO_DUE_DATE']) WITH ORDINALITY AS bucket(key,position)
        LEFT JOIN app.contract_obligations ob ON ob.tenant_id=$1 AND ob.status IN ('PENDING','IN_PROGRESS') AND bucket.key = CASE
          WHEN ob.due_date IS NULL THEN 'NO_DUE_DATE'
          WHEN ob.due_date < $2::date-30 THEN 'OVERDUE_30'
          WHEN ob.due_date < $2::date THEN 'OVERDUE'
          WHEN ob.due_date <= $2::date+7 THEN 'NEXT_7'
          WHEN ob.due_date <= $2::date+30 THEN 'NEXT_30'
          WHEN ob.due_date <= $2::date+90 THEN 'NEXT_90'
          ELSE 'LATER' END
       GROUP BY bucket.key,bucket.position ORDER BY bucket.position`, [tenantId, clock.today]);
    const delivery = await this.rows(client, `WITH ${ACTIVE_PURCHASES}
      SELECT p.contract_id,p.external_number,cp.legal_name AS counterparty,p.commodity,
             p.delivery_start::text,p.delivery_end::text,(p.quantity_sc*60)::text AS contracted_kg,
             p.received_kg::text,p.scheduled_kg::text
        FROM purchases p JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=($1,p.counterparty_id)
       ORDER BY p.delivery_end,p.delivery_start LIMIT 10`, [tenantId]);
    const upcoming = await this.rows(client, `SELECT ob.id,ob.contract_id,ob.title,ob.status,ob.due_date::text,ob.responsible_name,
             cp.legal_name AS counterparty,pct.external_number
        FROM app.contract_obligations ob
        JOIN app.contracts c ON (c.tenant_id,c.id)=(ob.tenant_id,ob.contract_id)
        JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
        JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
        LEFT JOIN app.purchase_contract_terms pct ON (pct.tenant_id,pct.contract_id)=(c.tenant_id,c.id)
       WHERE ob.tenant_id=$1 AND ob.status IN ('PENDING','IN_PROGRESS')
       ORDER BY ob.due_date NULLS LAST,ob.created_at LIMIT 6`, [tenantId]);
    return {
      indicators: { ...this.camel(row), ...this.camel(totals) },
      breakdowns: {
        statusMix, obligationAging: aging, deliveryByContract: delivery, upcomingObligations: upcoming,
        marginByContract: await this.marginByContract(client, clock),
      },
      drilldowns: { contracts: '/v1/contracts' },
    };
  }

  private async operations(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='SCHEDULED') AS scheduled_loads,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='IN_RECEIVING') AS loads_in_receiving,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='RECEIVED') AS received_loads,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status='SCHEDULED' AND scheduled_at<now()) AS delayed_loads,
      (SELECT count(*)::int FROM app.loads WHERE tenant_id=$1 AND status<>'CANCELLED' AND (scheduled_at AT TIME ZONE $3)::date=$2::date) AS loads_today,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN') AS open_occurrences,
      (SELECT count(*)::int FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN' AND severity='CRITICAL') AS critical_occurrences,
      (SELECT count(*)::int FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true AND quality_decision='REVIEW_REQUIRED') AS quality_reviews,
      (SELECT COALESCE(sum(net_weight_kg),0)::text FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true) AS received_weight_kg,
      (SELECT COALESCE(sum(net_weight_kg),0)::text FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true AND received_at>=now()-interval '30 days') AS received_last_30_days_kg`,
      tenantId, [clock.today, clock.timezone]);
    const byDay = await this.rows(client, `WITH days AS (SELECT $2::date + g AS day FROM generate_series(-7,13) g)
      SELECT d.day::text,
             count(l.id) FILTER (WHERE l.status='RECEIVED')::int AS received,
             count(l.id) FILTER (WHERE l.status='IN_RECEIVING')::int AS receiving,
             count(l.id) FILTER (WHERE l.status='SCHEDULED' AND l.scheduled_at>=now())::int AS scheduled,
             count(l.id) FILTER (WHERE l.status='SCHEDULED' AND l.scheduled_at<now())::int AS delayed
        FROM days d
        LEFT JOIN app.loads l ON l.tenant_id=$1 AND l.status<>'CANCELLED' AND (l.scheduled_at AT TIME ZONE $3)::date=d.day
       GROUP BY d.day ORDER BY d.day`, [tenantId, clock.today, clock.timezone]);
    const receivedByWeek = await this.rows(client, `WITH weeks AS (
        SELECT date_trunc('week',$2::date)::date - 7*g AS week FROM generate_series(0,7) g
      )
      SELECT w.week::text,COALESCE(sum(r.net_weight_kg),0)::text AS net_weight_kg,count(r.id)::int AS receipts
        FROM weeks w
        LEFT JOIN app.load_receipts r ON r.tenant_id=$1 AND r.is_current=true
         AND (r.received_at AT TIME ZONE $3)::date >= w.week AND (r.received_at AT TIME ZONE $3)::date < w.week+7
       GROUP BY w.week ORDER BY w.week`, [tenantId, clock.today, clock.timezone]);
    const quality = await this.one(client, `SELECT count(*)::int AS receipts,
             count(*) FILTER (WHERE quality_decision='ACCEPTED')::int AS accepted,
             count(*) FILTER (WHERE quality_decision='REVIEW_REQUIRED')::int AS review_required,
             avg(moisture_pct)::numeric(9,2)::text AS moisture_avg,max(moisture_pct)::text AS moisture_max,
             avg(impurity_pct)::numeric(9,2)::text AS impurity_avg,max(impurity_pct)::text AS impurity_max,
             avg(damaged_pct)::numeric(9,2)::text AS damaged_avg,max(damaged_pct)::text AS damaged_max
        FROM app.load_receipts WHERE tenant_id=$1 AND is_current=true AND received_at>=now()-interval '30 days'`, tenantId);
    const occurrences = await this.rows(client, `SELECT category,
             count(*) FILTER (WHERE severity='CRITICAL')::int AS critical,
             count(*) FILTER (WHERE severity='WARNING')::int AS warning,
             count(*) FILTER (WHERE severity='INFO')::int AS info
        FROM app.load_occurrences WHERE tenant_id=$1 AND status='OPEN'
       GROUP BY category ORDER BY count(*) DESC`, [tenantId]);
    const upcoming = await this.rows(client, `SELECT l.id,l.status,l.scheduled_at,l.vehicle_plate,l.carrier_name,
             l.expected_weight_kg::text,cp.legal_name AS counterparty,o.commodity,(l.scheduled_at<now()) AS delayed
        FROM app.loads l
        JOIN app.contracts c ON (c.tenant_id,c.id)=(l.tenant_id,l.contract_id)
        JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
        JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
       WHERE l.tenant_id=$1 AND l.status IN ('SCHEDULED','IN_RECEIVING')
       ORDER BY (l.status='IN_RECEIVING') DESC,l.scheduled_at LIMIT 6`, [tenantId]);
    return {
      indicators: this.camel(row),
      breakdowns: {
        loadsByDay: byDay, receivedByWeek, qualityLast30Days: quality,
        occurrencesByCategory: occurrences, upcomingLoads: upcoming,
      },
      drilldowns: {
        yard: '/v1/operations/yard', receiving: '/v1/operations/receiving',
        occurrences: '/v1/operations/occurrences', quality: '/v1/operations/quality',
      },
    };
  }

  private async inventory(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.inventory_locations WHERE tenant_id=$1 AND status='ACTIVE') AS active_locations,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND status='AVAILABLE') AS available_lots,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND status='BLOCKED_REVIEW') AS blocked_lots,
      (SELECT count(*)::int FROM app.inventory_transfers WHERE tenant_id=$1 AND status='IN_TRANSIT') AS transfers_in_transit,
      (SELECT COALESCE(sum(quantity_delta_kg),0)::text FROM app.inventory_movements WHERE tenant_id=$1) AS physical_quantity_kg,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND ownership_status='PENDING_DEFINITION') AS ownership_pending,
      (SELECT count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 AND risk_status='PENDING_DEFINITION') AS risk_classification_pending`, tenantId);
    const byCommodity = await this.rows(client, `SELECT lot.commodity,COALESCE(sum(m.quantity_delta_kg),0)::text AS quantity_kg,
             count(DISTINCT lot.id)::int AS lots
         FROM app.inventory_lots lot
         LEFT JOIN app.inventory_movements m ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
        WHERE lot.tenant_id=$1 GROUP BY lot.commodity ORDER BY lot.commodity`, [tenantId]);
    const byLocation = await this.rows(client, `SELECT loc.id,loc.code,loc.name,
             COALESCE(sum(m.quantity_delta_kg),0)::text AS quantity_kg,count(DISTINCT lot.id)::int AS lots
        FROM app.inventory_locations loc
        LEFT JOIN app.inventory_lots lot ON (lot.tenant_id,lot.location_id)=(loc.tenant_id,loc.id)
        LEFT JOIN app.inventory_movements m ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
       WHERE loc.tenant_id=$1 AND loc.status='ACTIVE'
       GROUP BY loc.id,loc.code,loc.name ORDER BY COALESCE(sum(m.quantity_delta_kg),0) DESC LIMIT 8`, [tenantId]);
    const movements = await this.rows(client, `WITH weeks AS (
        SELECT date_trunc('week',$2::date)::date - 7*g AS week FROM generate_series(0,7) g
      )
      SELECT w.week::text,
             COALESCE(sum(m.quantity_delta_kg) FILTER (WHERE m.quantity_delta_kg>0),0)::text AS inbound_kg,
             COALESCE(-sum(m.quantity_delta_kg) FILTER (WHERE m.quantity_delta_kg<0),0)::text AS outbound_kg
        FROM weeks w
        LEFT JOIN app.inventory_movements m ON m.tenant_id=$1
         AND (m.occurred_at AT TIME ZONE $3)::date >= w.week AND (m.occurred_at AT TIME ZONE $3)::date < w.week+7
       GROUP BY w.week ORDER BY w.week`, [tenantId, clock.today, clock.timezone]);
    const governance = await this.rows(client, `SELECT 'OWNERSHIP' AS dimension,ownership_status AS status,count(*)::int AS lots
        FROM app.inventory_lots WHERE tenant_id=$1 GROUP BY ownership_status
      UNION ALL SELECT 'RISK',risk_status,count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 GROUP BY risk_status
      UNION ALL SELECT 'CUSTODY',custody_status,count(*)::int FROM app.inventory_lots WHERE tenant_id=$1 GROUP BY custody_status
      ORDER BY 1,2`, [tenantId]);
    return {
      indicators: this.camel(row),
      breakdowns: { physicalByCommodity: byCommodity, physicalByLocation: byLocation,
        movementsByWeek: movements, lotGovernance: governance },
      drilldowns: { position: '/v1/inventory' },
    };
  }

  private async risk(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
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
      const utilization = limit && limit.gt(0) ? net.div(limit).times(100).toDecimalPlaces(2).toString() : null;
      return { ...position, status, utilization_pct: utilization };
    });
    const utilizations = mapped.map((item) => item.utilization_pct).filter((value): value is string => value !== null);
    const exposure = await this.rows(client, `WITH ${ACTIVE_PURCHASES}, ${ACTIVE_SALES},
      months AS (SELECT (date_trunc('month',$2::date) + make_interval(months => g))::date AS month FROM generate_series(0,5) g)
      SELECT m.month::text,
        COALESCE((SELECT sum(GREATEST(p.quantity_sc*60-p.received_kg,0)) FROM purchases p
          WHERE GREATEST(date_trunc('month',p.delivery_end)::date,date_trunc('month',$2::date)::date)=m.month),0)::text AS purchase_open_kg,
        COALESCE((SELECT sum(GREATEST(s.quantity_kg-s.dispatched_kg,0)) FROM sales s
          WHERE GREATEST(date_trunc('month',s.delivery_end)::date,date_trunc('month',$2::date)::date)=m.month),0)::text AS sales_open_kg
        FROM months m ORDER BY m.month`, [tenantId, clock.today]);
    return { indicators: {
      commodityCount: mapped.length,
      warningCount: mapped.filter((item) => item.status === 'WARNING').length,
      exceededCount: mapped.filter((item) => item.status === 'EXCEEDED').length,
      unconfiguredCount: mapped.filter((item) => item.status === 'UNCONFIGURED').length,
      netOpenKg: mapped.reduce((sum, item) => sum.plus(item.net_open_kg), new Decimal(0)).toString(),
      maxUtilizationPct: utilizations.length
        ? Decimal.max(...utilizations.map((value) => new Decimal(value))).toString() : null,
    }, breakdowns: { positions: mapped, exposureByMonth: exposure }, drilldowns: { workspace: '/v1/risk' },
    unavailable: ['MTM', 'P&L', 'PRICE_EXPOSURE', 'BASE_EXPOSURE', 'FX_EXPOSURE', 'VAR'] };
  }

  private async financial(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `WITH ${OPEN_BALANCES}
    SELECT
      COALESCE(sum(outstanding) FILTER (WHERE direction='INFLOW'),0)::text AS receivable_amount,
      COALESCE(sum(outstanding) FILTER (WHERE direction='OUTFLOW'),0)::text AS payable_amount,
      count(*) FILTER (WHERE due_date<$2::date AND outstanding>0)::int AS overdue_titles,
      COALESCE(sum(outstanding) FILTER (WHERE direction='INFLOW' AND due_date<$2::date),0)::text AS overdue_receivable_amount,
      COALESCE(sum(outstanding) FILTER (WHERE direction='OUTFLOW' AND due_date<$2::date),0)::text AS overdue_payable_amount,
      (SELECT count(*)::int FROM app.financial_events WHERE tenant_id=$1 AND calculation_status='PENDING_ROUNDING_POLICY') AS pending_rounding,
      (SELECT count(*)::int FROM app.payment_batches WHERE tenant_id=$1 AND status='PENDING_APPROVAL') AS payment_batches_pending_approval,
      (SELECT COALESCE(sum(total_amount),0)::text FROM app.payment_batches WHERE tenant_id=$1 AND status='PENDING_APPROVAL') AS payment_batches_pending_amount,
      (SELECT count(*)::int FROM app.bank_statement_entries WHERE tenant_id=$1 AND status='UNMATCHED') AS unmatched_bank_entries,
      (SELECT count(*)::int FROM app.bank_statement_entries WHERE tenant_id=$1 AND status='MATCHED') AS matched_bank_entries,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_settlements WHERE tenant_id=$1) AS received_amount,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_payments WHERE tenant_id=$1) AS paid_amount,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_settlements WHERE tenant_id=$1 AND received_at>=now()-interval '30 days') AS received_last_30_days,
      (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0)::text FROM app.financial_payments WHERE tenant_id=$1 AND paid_at>=now()-interval '30 days') AS paid_last_30_days
      FROM balances`, tenantId, [clock.today]);
    const cashByMonth = await this.rows(client, `WITH months AS (
        SELECT (date_trunc('month',$2::date) - make_interval(months => g))::date AS month FROM generate_series(0,5) g
      )
      SELECT m.month::text,
        COALESCE((SELECT sum(st.amount) FROM app.financial_settlements st WHERE st.tenant_id=$1 AND st.reversed_at IS NULL
          AND date_trunc('month',(st.received_at AT TIME ZONE $3))::date=m.month),0)::text AS received,
        COALESCE((SELECT sum(pm.amount) FROM app.financial_payments pm WHERE pm.tenant_id=$1 AND pm.reversed_at IS NULL
          AND date_trunc('month',(pm.paid_at AT TIME ZONE $3))::date=m.month),0)::text AS paid
        FROM months m ORDER BY m.month`, [tenantId, clock.today, clock.timezone]);
    const aging = await this.rows(client, `WITH ${OPEN_BALANCES}
      SELECT direction.key AS direction,bucket.key AS bucket,
             COALESCE(sum(b.outstanding),0)::text AS amount,count(b.due_date)::int AS titles
        FROM unnest(ARRAY['INFLOW','OUTFLOW']) AS direction(key)
       CROSS JOIN unnest(ARRAY['CURRENT','D1_30','D31_60','D61_PLUS']) WITH ORDINALITY AS bucket(key,position)
        LEFT JOIN balances b ON b.direction=direction.key AND b.outstanding>0 AND bucket.key = CASE
          WHEN b.due_date >= $2::date THEN 'CURRENT'
          WHEN b.due_date >= $2::date-30 THEN 'D1_30'
          WHEN b.due_date >= $2::date-60 THEN 'D31_60'
          ELSE 'D61_PLUS' END
       GROUP BY direction.key,bucket.key,bucket.position ORDER BY direction.key,bucket.position`, [tenantId, clock.today]);
    const topReceivables = await this.rows(client, `WITH ${OPEN_BALANCES}
      SELECT cp.id,COALESCE(cp.legal_name,'Sem contraparte') AS name,
             sum(b.outstanding)::text AS amount,count(*)::int AS titles,
             COALESCE(sum(b.outstanding) FILTER (WHERE b.due_date<$2::date),0)::text AS overdue_amount
        FROM balances b LEFT JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=($1,b.counterparty_id)
       WHERE b.direction='INFLOW' AND b.outstanding>0
       GROUP BY cp.id,cp.legal_name ORDER BY sum(b.outstanding) DESC LIMIT 6`, [tenantId, clock.today]);
    return {
      indicators: this.camel(row),
      breakdowns: {
        dueByWeek: await this.dueByWeek(client, clock), cashByMonth, aging, topReceivables,
      },
      drilldowns: { workspace: '/v1/finance' },
    };
  }

  private async fiscal(client: PoolClient, clock: Clock) {
    const { tenantId } = clock;
    const row = await this.one(client, `SELECT
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='RECEIVED') AS documents_pending_validation,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='VALIDATED') AS validated_documents,
      (SELECT count(*)::int FROM app.fiscal_documents WHERE tenant_id=$1 AND status='REJECTED') AS rejected_documents,
      (SELECT count(*)::int FROM app.fiscal_configuration_versions WHERE tenant_id=$1 AND status='ACTIVE') AS active_configurations,
      (SELECT count(*)::int FROM app.fiscal_calculations WHERE tenant_id=$1 AND status='CALCULATED') AS calculations_pending_acceptance,
      (SELECT count(*)::int FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN') AS open_obligations,
      (SELECT count(*)::int FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN' AND due_date<$2::date) AS overdue_obligations,
      (SELECT COALESCE(sum(amount),0)::text FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN') AS open_obligation_amount,
      (SELECT COALESCE(sum(total_amount),0)::text FROM app.fiscal_documents WHERE tenant_id=$1 AND status='VALIDATED') AS validated_amount`,
      tenantId, [clock.today]);
    const documentsByMonth = await this.rows(client, `WITH months AS (
        SELECT (date_trunc('month',$2::date) - make_interval(months => g))::date AS month FROM generate_series(0,5) g
      )
      SELECT m.month::text,
             count(d.id) FILTER (WHERE d.status='VALIDATED')::int AS validated,
             count(d.id) FILTER (WHERE d.status='RECEIVED')::int AS received,
             count(d.id) FILTER (WHERE d.status='REJECTED')::int AS rejected,
             COALESCE(sum(d.total_amount),0)::text AS amount
        FROM months m
        LEFT JOIN app.fiscal_documents d ON d.tenant_id=$1
         AND date_trunc('month',(COALESCE(d.issued_at,d.created_at) AT TIME ZONE $3))::date=m.month
       GROUP BY m.month ORDER BY m.month`, [tenantId, clock.today, clock.timezone]);
    const byComponent = await this.rows(client, `SELECT component_tax,sum(amount)::text AS amount,count(*)::int AS obligations,
             count(*) FILTER (WHERE due_date<$2::date)::int AS overdue
        FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN'
       GROUP BY component_tax ORDER BY sum(amount) DESC`, [tenantId, clock.today]);
    const upcoming = await this.rows(client, `SELECT id,component_tax,competence_date::text,due_date::text,amount::text,retained
        FROM app.fiscal_obligations WHERE tenant_id=$1 AND status='OPEN'
       ORDER BY due_date NULLS LAST LIMIT 6`, [tenantId]);
    const taxByMonth = await this.rows(client, `WITH months AS (
        SELECT (date_trunc('month',$2::date) - make_interval(months => g))::date AS month FROM generate_series(0,5) g
      )
      SELECT m.month::text,COALESCE(sum(fc.gross_amount),0)::text AS gross_amount,
             COALESCE(sum(fc.tax_total),0)::text AS tax_total,count(fc.id)::int AS calculations
        FROM months m
        LEFT JOIN app.fiscal_calculations fc ON fc.tenant_id=$1 AND date_trunc('month',fc.occurred_on)::date=m.month
       GROUP BY m.month ORDER BY m.month`, [tenantId, clock.today]);
    return {
      indicators: this.camel(row),
      breakdowns: { documentsByMonth, openTaxesByComponent: byComponent, upcomingObligations: upcoming, taxByMonth },
      drilldowns: { workspace: '/v1/fiscal' },
    };
  }

  private flowByCommodity(client: PoolClient, clock: Clock) {
    return this.rows(client, `WITH ${ACTIVE_PURCHASES}, ${ACTIVE_SALES},
      purchase AS (SELECT commodity,sum(quantity_sc*60) AS contracted_kg,sum(received_kg) AS received_kg
                     FROM purchases GROUP BY commodity),
      sale AS (SELECT commodity,sum(quantity_kg) AS contracted_kg,sum(dispatched_kg) AS dispatched_kg
                 FROM sales GROUP BY commodity)
      SELECT commodity,COALESCE(purchase.contracted_kg,0)::text AS purchase_contracted_kg,
             COALESCE(purchase.received_kg,0)::text AS purchase_received_kg,
             COALESCE(sale.contracted_kg,0)::text AS sales_contracted_kg,
             COALESCE(sale.dispatched_kg,0)::text AS sales_dispatched_kg
        FROM purchase FULL JOIN sale USING (commodity) ORDER BY commodity`, [clock.tenantId]);
  }

  private dueByWeek(client: PoolClient, clock: Clock) {
    return this.rows(client, `WITH ${OPEN_BALANCES},
      weeks AS (SELECT date_trunc('week',$2::date)::date + 7*g AS week FROM generate_series(0,7) g)
      SELECT 'OVERDUE' AS bucket,NULL::text AS week,
             COALESCE(sum(outstanding) FILTER (WHERE direction='INFLOW'),0)::text AS inflow,
             COALESCE(sum(outstanding) FILTER (WHERE direction='OUTFLOW'),0)::text AS outflow
        FROM balances WHERE outstanding>0 AND due_date<$2::date
      UNION ALL
      SELECT 'WEEK',w.week::text,
             COALESCE(sum(b.outstanding) FILTER (WHERE b.direction='INFLOW'),0)::text,
             COALESCE(sum(b.outstanding) FILTER (WHERE b.direction='OUTFLOW'),0)::text
        FROM weeks w LEFT JOIN balances b ON b.outstanding>0 AND b.due_date>=$2::date
         AND b.due_date>=w.week AND b.due_date<w.week+7
       GROUP BY w.week
      ORDER BY 1,2`, [clock.tenantId, clock.today]);
  }

  private marginByContract(client: PoolClient, clock: Clock) {
    return this.rows(client, `WITH ${ACTIVE_PURCHASES}
      SELECT p.contract_id,p.external_number,cp.legal_name AS counterparty,p.commodity,
             p.quantity_sc::text,p.projected_margin_per_sc::text AS margin_per_sc,
             (p.quantity_sc*p.projected_margin_per_sc)::text AS amount
        FROM purchases p JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=($1,p.counterparty_id)
       WHERE p.projected_margin_per_sc IS NOT NULL
       ORDER BY p.quantity_sc*p.projected_margin_per_sc DESC LIMIT 8`, [clock.tenantId]);
  }

  // Buckets follow the operation's calendar. The worker role reads only
  // operational tables, so the timezone is fixed here rather than read from
  // app.tenants; every tenant currently operates on Brasília time.
  private async clock(client: PoolClient, tenantId: string): Promise<Clock> {
    const result = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE $1)::date::text AS today`, [DASHBOARD_TIMEZONE]);
    return { tenantId, today: result.rows[0]?.today ?? new Date().toISOString().slice(0, 10),
      timezone: DASHBOARD_TIMEZONE };
  }

  private async one(client: PoolClient, sql: string, tenantId: string, extra: unknown[] = []): Promise<QueryResultRow> {
    const result = await client.query(sql, [tenantId, ...extra]);
    return result.rows[0] ?? {};
  }

  private async rows(client: PoolClient, sql: string, params: unknown[]): Promise<QueryResultRow[]> {
    const result = await client.query(sql, params);
    return result.rows;
  }

  private camel(row: QueryResultRow): QueryResultRow {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value,
    ]));
  }
}
