import { describe, expect, it } from 'vitest';
import { OutboxMetrics } from './metrics.js';

describe('OutboxMetrics', () => {
  it('exports bounded Prometheus counters, histogram and queue gauges', () => {
    const metrics = new OutboxMetrics();
    metrics.recordEvents('tenant-a', 'claimed', 2);
    metrics.recordEvents('tenant-a', 'published');
    metrics.recordEvents('tenant-a', 'failed');
    metrics.recordEvents('tenant-a', 'retry_scheduled');
    metrics.recordBatch('tenant-a', 'partial_failure', 0.08, {
      pending: 3,
      delayed: 1,
      oldestPendingAgeSeconds: 42,
    });

    const output = metrics.render();
    expect(output).toContain('tier_trade_outbox_events_total{tenant_id="tenant-a",outcome="claimed"} 2');
    expect(output).toContain('tier_trade_outbox_batches_total{tenant_id="tenant-a",outcome="partial_failure"} 1');
    expect(output).toContain('tier_trade_outbox_batch_duration_seconds_bucket{tenant_id="tenant-a",le="0.1"} 1');
    expect(output).toContain('tier_trade_outbox_pending_events{tenant_id="tenant-a"} 3');
    expect(output).toContain('tier_trade_outbox_oldest_pending_age_seconds{tenant_id="tenant-a"} 42');
  });
});
