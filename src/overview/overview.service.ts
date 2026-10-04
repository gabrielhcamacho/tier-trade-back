import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CommercialService } from '../commercial/commercial.service.js';
import { DatabasePlatformPort } from '../database/database.js';
import { FinanceService } from '../finance/finance.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RiskService } from '../risk/risk.service.js';

export type OverviewFilter = { commodity?: string; unit?: string; crop?: string; period?: string };
type Commodity = 'MILHO' | 'SOJA';

function exactMoney(value: Decimal): string | null {
  return value.times(100).isInteger() ? value.toFixed(2) : null;
}

@Injectable()
export class OverviewService {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(CommercialService) private readonly commercial: CommercialService,
    @Inject(FinanceService) private readonly finance: FinanceService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(RiskService) private readonly risk: RiskService,
  ) {}

  async overview(tenantId: string, actorId: string, filter: OverviewFilter) {
    if (filter.commodity && filter.commodity !== 'MILHO' && filter.commodity !== 'SOJA') {
      throw new BadRequestException({ code: 'OVERVIEW_COMMODITY_UNSUPPORTED' });
    }
    if (filter.unit || filter.crop || filter.period) {
      throw new BadRequestException({ code: 'OVERVIEW_FILTER_NOT_MODELED',
        unsupported: ['unit', 'crop', 'period'].filter((name) => Boolean(filter[name as keyof OverviewFilter])) });
    }
    const commodity = filter.commodity as Commodity | undefined;
    const access = await this.db.transaction(tenantId, async (client) => {
      const result = await client.query<{ capabilities: string[]; legal_name: string; is_demo: boolean; timezone: string }>(
        `SELECT m.capabilities,t.legal_name,t.is_demo,t.timezone
           FROM app.memberships m JOIN app.tenants t ON t.id=m.tenant_id
          WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.active=true`, [tenantId, actorId]);
      if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_REQUIRED' });
      return result.rows[0]!;
    });
    // Each domain remains its data owner. This read model composes their public,
    // tenant-scoped workspaces; it does not write or recalculate official ledgers.
    const [offers, contracts, finance, inventory, risk] = await Promise.all([
      this.commercial.listOffers(tenantId, actorId),
      this.commercial.listContracts(tenantId, actorId),
      this.finance.workspace(tenantId, actorId),
      this.inventory.position(tenantId, actorId),
      this.risk.workspace(tenantId, actorId),
    ]);
    const offerItems = offers.items.filter((item) => !commodity || item.commodity === commodity);
    const contractItems = contracts.items.filter((item) => item.status === 'ACTIVE'
      && (!commodity || item.commodity === commodity));
    const sales = inventory.salesContracts.filter((item) => item.status === 'ACTIVE'
      && (!commodity || item.commodity === commodity));
    const positions = risk.positions.filter((item) => !commodity || item.commodity === commodity);
    const approvals = offerItems.filter((item) => item.status === 'IN_APPROVAL');
    const obligations = contractItems.reduce((sum, item) => sum + Number(item.pending_obligations), 0);

    const marginComponents = contractItems.map((item) => {
      const raw = new Decimal(item.quantity_sc).times(item.projected_margin_per_sc);
      return { contractId: item.id, counterpartyName: item.counterparty_name, commodity: item.commodity,
        policyVersion: item.policy_version ?? null, quantitySc: String(item.quantity_sc),
        marginPerSc: String(item.projected_margin_per_sc), amount: exactMoney(raw),
        calculationStatus: exactMoney(raw) === null ? 'PENDING_ROUNDING_POLICY' : 'READY' };
    });
    const rawMargin = contractItems.reduce((sum, item) => sum.plus(
      new Decimal(item.quantity_sc).times(item.projected_margin_per_sc)), new Decimal(0));
    const marginTotal = contractItems.length && marginComponents.every((item) => item.amount !== null)
      ? exactMoney(rawMargin) : null;
    const purchaseContractedKg = contractItems.reduce((sum, item) => sum.plus(
      new Decimal(item.quantity_sc).times(60)), new Decimal(0));
    const purchaseReceivedKg = contractItems.reduce((sum, item) => sum.plus(item.received_weight_kg), new Decimal(0));
    const salesContractedKg = sales.reduce((sum, item) => sum.plus(item.quantity_kg), new Decimal(0));
    const salesDispatchedKg = sales.reduce((sum, item) => sum.plus(item.dispatched_kg), new Decimal(0));

    const due = new Map<string, { inflow: Decimal; outflow: Decimal; titleIds: string[] }>();
    for (const event of finance.events) {
      if (!event.title || new Decimal(event.title.outstandingAmount).lte(0)) continue;
      const date = event.title.dueDate;
      const bucket = due.get(date) ?? { inflow: new Decimal(0), outflow: new Decimal(0), titleIds: [] };
      bucket[event.direction === 'INFLOW' ? 'inflow' : 'outflow'] =
        bucket[event.direction === 'INFLOW' ? 'inflow' : 'outflow'].plus(event.title.outstandingAmount);
      bucket.titleIds.push(event.title.id);
      due.set(date, bucket);
    }
    const dueDates = [...due.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, bucket]) => ({
      date, inflowAmount: exactMoney(bucket.inflow), outflowAmount: exactMoney(bucket.outflow),
      netKnownAmount: exactMoney(bucket.inflow.minus(bucket.outflow)), titleIds: bucket.titleIds,
    }));
    const byCommodity = [...new Set([...contractItems.map((item) => item.commodity),
      ...sales.map((item) => item.commodity)])].sort().map((name) => ({
      commodity: name,
      purchaseContractedKg: contractItems.filter((item) => item.commodity === name)
        .reduce((sum, item) => sum.plus(new Decimal(item.quantity_sc).times(60)), new Decimal(0)).toString(),
      purchaseReceivedKg: contractItems.filter((item) => item.commodity === name)
        .reduce((sum, item) => sum.plus(item.received_weight_kg), new Decimal(0)).toString(),
      salesContractedKg: sales.filter((item) => item.commodity === name)
        .reduce((sum, item) => sum.plus(item.quantity_kg), new Decimal(0)).toString(),
      salesDispatchedKg: sales.filter((item) => item.commodity === name)
        .reduce((sum, item) => sum.plus(item.dispatched_kg), new Decimal(0)).toString(),
    }));
    const exceptions = [
      ...approvals.map((item) => ({ type: 'OFFER_APPROVAL', sourceId: item.id,
        commodity: item.commodity, impactQuantitySc: String(item.quantity_sc), decisionOwner: 'COMMERCIAL_APPROVE' })),
      ...positions.filter((item) => item.limit.status === 'WARNING' || item.limit.status === 'EXCEEDED')
        .map((item) => ({ type: 'RISK_LIMIT', sourceId: item.limit.id, commodity: item.commodity,
          status: item.limit.status, policyVersion: item.limit.version, decisionOwner: 'RISK_MANAGE' })),
      ...contractItems.filter((item) => Number(item.pending_obligations) > 0)
        .map((item) => ({ type: 'CONTRACT_OBLIGATION', sourceId: item.id, commodity: item.commodity,
          pendingCount: Number(item.pending_obligations), decisionOwner: 'COMMERCIAL_EDIT' })),
    ];

    return {
      contractVersion: 1,
      assembledAt: new Date().toISOString(),
      consistency: 'MULTI_TRANSACTION',
      tenant: { id: tenantId, legalName: access.legal_name, isDemo: access.is_demo, timezone: access.timezone },
      access: { scope: 'TENANT', capabilities: access.capabilities, profileStatus: 'NOT_MODELED',
        unitScopeStatus: 'NOT_MODELED' },
      filters: { commodity: commodity ?? null, appliedTo: ['offers', 'contracts', 'physical', 'risk'],
        financeScope: 'TENANT_CONSOLIDATED', unsupported: ['unit', 'crop', 'period'] },
      indicators: {
        projectedMarginAmount: marginTotal,
        projectedMarginStatus: !contractItems.length ? 'NO_DATA'
          : marginTotal === null || marginComponents.some((item) => item.amount === null)
            ? 'PENDING_ROUNDING_POLICY' : 'READY',
        purchaseContractedKg: purchaseContractedKg.toString(),
        purchaseReceivedKg: purchaseReceivedKg.toString(),
        salesContractedKg: salesContractedKg.toString(),
        salesDispatchedKg: salesDispatchedKg.toString(),
        receivedAmount: finance.summary.receivedAmount,
        paidAmount: finance.summary.paidAmount,
        netCashFlowAmount: finance.summary.netCashFlowAmount,
        receivableAmount: finance.summary.receivableAmount,
        payableAmount: finance.summary.payableAmount,
        pendingApprovalCount: approvals.length,
        pendingObligationCount: obligations,
      },
      charts: { marginComponents, dueDates, byCommodity },
      exceptions,
      unavailable: [
        { code: 'REALIZED_MARGIN_BRIDGE', reason: 'Margem realizada e causas ainda não homologadas.' },
        { code: 'CASH_PROJECTION', reason: 'Saldo bancário inicial e movimentos não titulados indisponíveis.' },
        { code: 'AI_INSIGHTS', reason: 'Motor de evidências e confiança ainda não habilitado.' },
        { code: 'ROLE_AND_UNIT_SCOPE', reason: 'Papéis, equipes e unidades operacionais ainda não modelados.' },
      ],
      sources: { offers, contracts, finance, inventory, risk },
    };
  }
}
