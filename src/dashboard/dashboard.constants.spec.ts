import { describe, expect, it } from 'vitest';
import { DASHBOARD_MODULES, dashboardModulesForEvent } from './dashboard.constants.js';

describe('dashboard event routing', () => {
  it('always invalidates central and only the owning module', () => {
    expect(dashboardModulesForEvent('offer.approved')).toEqual(['central', 'commercial']);
    expect(dashboardModulesForEvent('load.receipt_recorded')).toEqual([
      'central', 'contracts', 'operations', 'inventory', 'risk',
    ]);
    expect(dashboardModulesForEvent('finance.payment_recorded')).toEqual(['central', 'risk', 'financial']);
  });

  it('rebuilds every module after a demo reset', () => {
    expect(dashboardModulesForEvent('demo.seed_reset')).toEqual(DASHBOARD_MODULES);
  });
});
