import { describe, expect, it, vi } from 'vitest';
import type { DatabasePlatformPort } from '../database/database.js';
import { DashboardQueryService } from './dashboard-query.service.js';

function fixture(rows: unknown[] = []) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
    .mockResolvedValueOnce({ rowCount: rows.length, rows })
    .mockResolvedValueOnce({ rowCount: 1, rows: [] });
  const transaction = vi.fn(async (_tenantId: string, operation: (client: { query: typeof query }) => unknown) =>
    operation({ query }));
  return { service: new DashboardQueryService({ transaction } as unknown as DatabasePlatformPort), query };
}

describe('dashboard query service', () => {
  it('returns rebuilding and schedules a missing snapshot', async () => {
    const { service, query } = fixture();
    const result = await service.one('tenant-1', 'actor-1', 'commercial');
    expect(result.body).toMatchObject({ module: 'commercial', freshness: 'REBUILDING', payload: null });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('rejects unknown modules before touching the database', async () => {
    const { service, query } = fixture();
    await expect(service.one('tenant-1', 'actor-1', 'unknown')).rejects.toMatchObject({
      response: { code: 'DASHBOARD_MODULE_UNSUPPORTED' },
    });
    expect(query).not.toHaveBeenCalled();
  });
});
