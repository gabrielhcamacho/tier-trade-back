export const DASHBOARD_MODULES = [
  'central',
  'commercial',
  'contracts',
  'operations',
  'inventory',
  'risk',
  'financial',
  'fiscal',
] as const;

export type DashboardModuleName = typeof DASHBOARD_MODULES[number];

export function isDashboardModule(value: string): value is DashboardModuleName {
  return DASHBOARD_MODULES.includes(value as DashboardModuleName);
}

export function dashboardModulesForEvent(eventType: string): DashboardModuleName[] {
  if (eventType === 'demo.seed_reset') return [...DASHBOARD_MODULES];
  const modules = new Set<DashboardModuleName>(['central']);
  if (eventType.startsWith('commercial.') || eventType.startsWith('offer.') ||
      eventType.startsWith('counterparty.') || eventType.startsWith('sales_contract.')) modules.add('commercial');
  if (eventType.startsWith('contract.') || eventType.startsWith('document.') ||
      eventType.startsWith('load.')) modules.add('contracts');
  if (eventType.startsWith('load.')) modules.add('operations');
  if (eventType.startsWith('inventory.') || eventType.startsWith('load.receipt_')) modules.add('inventory');
  if (eventType.startsWith('contract.') || eventType.startsWith('sales_contract.') ||
      eventType.startsWith('inventory.') || eventType.startsWith('load.receipt_') ||
      eventType.startsWith('finance.')) modules.add('risk');
  if (eventType.startsWith('risk.')) modules.add('risk');
  if (eventType.startsWith('finance.')) modules.add('financial');
  if (eventType.startsWith('fiscal.')) modules.add('fiscal');
  return [...modules];
}
