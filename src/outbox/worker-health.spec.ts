import { describe, expect, it } from 'vitest';
import { WorkerHealth } from './worker-health.js';

describe('outbox worker health', () => {
  it('reports startup, readiness, degradation, staleness and shutdown', () => {
    const health = new WorkerHealth(1_000);
    expect(health.snapshot()).toMatchObject({ status: 'starting', ready: false });

    health.batchCompleted({
      claimed: 1, published: 0, failed: 1, recovered: 0, durationMs: 5,
      pending: 1, delayed: 1, oldestPendingAgeSeconds: 2,
    });
    expect(health.snapshot()).toMatchObject({ status: 'degraded', ready: true, lastBatchFailed: 1 });
    expect(health.snapshot(Date.now() + 2_000)).toMatchObject({ status: 'stale', ready: false });
    health.stop();
    expect(health.snapshot()).toMatchObject({ status: 'stopping', ready: false });
  });
});
