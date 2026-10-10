import { describe, expect, it, vi } from 'vitest';
import { OverviewService } from './overview.service.js';
import type { DatabasePlatformPort } from '../database/database.js';
import type { CommercialService } from '../commercial/commercial.service.js';
import type { FinanceService } from '../finance/finance.service.js';
import type { FinanceGovernanceService } from '../finance/finance-governance.service.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import type { RiskService } from '../risk/risk.service.js';

function fixture() {
  const transaction = vi.fn(async (_tenant: string, callback: (client: unknown) => Promise<unknown>) =>
    callback({ query: vi.fn(async () => ({ rowCount: 1, rows: [{
      capabilities: ['COMMERCIAL_EDIT'], legal_name: 'JD', is_demo: false, timezone: 'America/Cuiaba',
    }] })) }));
  const listOffers = vi.fn(async () => ({ tenant: { legalName: 'JD', isDemo: false }, items: [
    { id: 'o1', commodity: 'MILHO', status: 'IN_APPROVAL', quantity_sc: '100' },
    { id: 'o2', commodity: 'SOJA', status: 'IN_APPROVAL', quantity_sc: '200' },
  ] }));
  const listContracts = vi.fn(async () => ({ tenant: { legalName: 'JD', isDemo: false }, items: [
    { id: 'c1', status: 'ACTIVE', commodity: 'MILHO', counterparty_name: 'Produtor', quantity_sc: '100',
      received_weight_kg: '1200.000', projected_margin_per_sc: '2.50', policy_version: 3, pending_obligations: 1 },
    { id: 'c2', status: 'ACTIVE', commodity: 'SOJA', counterparty_name: 'Produtor 2', quantity_sc: '200',
      received_weight_kg: '0', projected_margin_per_sc: '1.00', policy_version: 2, pending_obligations: 0 },
  ] }));
  const workspace = vi.fn(async () => ({
    summary: { receivedAmount: '40.00', paidAmount: '10.00', netCashFlowAmount: '30.00',
      receivableAmount: '60.00', payableAmount: '20.00' },
    events: [{ direction: 'INFLOW', title: { id: 't1', dueDate: '2026-11-01', outstandingAmount: '60.00' } }],
  }));
  const position = vi.fn(async () => ({ salesContracts: [
    { id: 's1', status: 'ACTIVE', commodity: 'MILHO', quantity_kg: '5000.000', dispatched_kg: '1000.000' },
  ] }));
  const governanceWorkspace = vi.fn(async () => ({
    realizedMargin: { status: 'NO_DATA', revenueAmount: '0.00', totalCostAmount: '0.00',
      realizedMarginAmount: '0.00', calculationScope: {
        basis: 'OPERATIONAL_REALIZED_MARGIN_V1', included: [], excluded: [], accountingResult: false,
      }, byCommodity: [] },
    paymentBatches: [], bankStatementEntries: [],
  }));
  const riskWorkspace = vi.fn(async () => ({ positions: [] }));
  const service = new OverviewService(
    { transaction } as unknown as DatabasePlatformPort,
    { listOffers, listContracts } as unknown as CommercialService,
    { workspace } as unknown as FinanceService,
    { workspace: governanceWorkspace } as unknown as FinanceGovernanceService,
    { position } as unknown as InventoryService,
    { workspace: riskWorkspace } as unknown as RiskService,
  );
  return { service, transaction, listOffers, listContracts };
}

describe('overview read model', () => {
  it('rejects filters without a trustworthy data model', async () => {
    const { service, transaction } = fixture();
    await expect(service.overview('tenant-1', 'user-1', { crop: '25/26' })).rejects.toMatchObject({
      response: { code: 'OVERVIEW_FILTER_NOT_MODELED', unsupported: ['crop'] },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('filters commodity data, but keeps finance explicitly tenant-consolidated', async () => {
    const { service, transaction, listOffers, listContracts } = fixture();
    const result = await service.overview('tenant-1', 'user-1', { commodity: 'MILHO' });
    expect(transaction).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(listOffers).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(listContracts).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(result.indicators.projectedMarginAmount).toBe('250.00');
    expect(result.indicators.purchaseContractedKg).toBe('6000');
    expect(result.indicators.purchaseReceivedKg).toBe('1200');
    expect(result.indicators.salesDispatchedKg).toBe('1000');
    expect(result.indicators.pendingApprovalCount).toBe(1);
    expect(result.indicators.receivableAmount).toBe('60.00');
    expect(result.filters.financeScope).toBe('TENANT_CONSOLIDATED');
    expect(result.charts.marginComponents).toHaveLength(1);
    expect(result.charts.marginComponents[0]?.policyVersion).toBe(3);
    expect(result.charts.dueDates[0]?.netKnownAmount).toBe('60.00');
    expect(result.access.scope).toBe('TENANT');
  });

  it('does not round sub-cent projected margin silently', async () => {
    const { service, listContracts } = fixture();
    listContracts.mockResolvedValueOnce({ tenant: { legalName: 'JD', isDemo: false }, items: [
      { id: 'c1', status: 'ACTIVE', commodity: 'MILHO', counterparty_name: 'Produtor', quantity_sc: '1',
        received_weight_kg: '0', projected_margin_per_sc: '0.005', policy_version: 1, pending_obligations: 0 },
    ] });
    const result = await service.overview('tenant-1', 'user-1', {});
    expect(result.indicators.projectedMarginAmount).toBeNull();
    expect(result.indicators.projectedMarginStatus).toBe('PENDING_ROUNDING_POLICY');
  });
});
