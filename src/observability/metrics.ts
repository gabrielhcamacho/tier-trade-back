import { Injectable } from '@nestjs/common';

type BatchOutcome = 'success' | 'partial_failure' | 'error';
type EventOutcome = 'claimed' | 'published' | 'failed' | 'recovered' | 'retry_scheduled';

const durationBuckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface TenantMetrics {
  batches: Record<BatchOutcome, number>;
  events: Record<EventOutcome, number>;
  durationBuckets: number[];
  durationCount: number;
  durationSum: number;
  pending: number;
  delayed: number;
  oldestPendingAgeSeconds: number;
  lastBatchTimestampSeconds: number;
  queueObserved: boolean;
}

@Injectable()
export class OutboxMetrics {
  private readonly tenants = new Map<string, TenantMetrics>();

  recordBatch(
    tenantId: string,
    outcome: BatchOutcome,
    durationSeconds: number,
    queue?: { pending: number; delayed: number; oldestPendingAgeSeconds: number },
  ): void {
    const metrics = this.forTenant(tenantId);
    metrics.batches[outcome] += 1;
    metrics.durationBuckets = metrics.durationBuckets.map((count, index) =>
      durationSeconds <= durationBuckets[index]! ? count + 1 : count,
    );
    metrics.durationCount += 1;
    metrics.durationSum += durationSeconds;
    if (queue) {
      metrics.pending = queue.pending;
      metrics.delayed = queue.delayed;
      metrics.oldestPendingAgeSeconds = queue.oldestPendingAgeSeconds;
      metrics.lastBatchTimestampSeconds = Date.now() / 1000;
      metrics.queueObserved = true;
    }
  }

  recordEvents(tenantId: string, outcome: EventOutcome, count = 1): void {
    this.forTenant(tenantId).events[outcome] += count;
  }

  render(): string {
    const lines = [
      '# HELP tier_trade_outbox_batches_total Completed outbox batches by outcome.',
      '# TYPE tier_trade_outbox_batches_total counter',
    ];
    for (const [tenantId, metrics] of this.sortedTenants()) {
      for (const outcome of ['success', 'partial_failure', 'error'] as const) {
        lines.push(`tier_trade_outbox_batches_total{tenant_id="${escapeLabel(tenantId)}",outcome="${outcome}"} ${metrics.batches[outcome]}`);
      }
    }

    lines.push(
      '# HELP tier_trade_outbox_events_total Outbox events by processing result.',
      '# TYPE tier_trade_outbox_events_total counter',
    );
    for (const [tenantId, metrics] of this.sortedTenants()) {
      for (const outcome of ['claimed', 'published', 'failed', 'recovered', 'retry_scheduled'] as const) {
        lines.push(`tier_trade_outbox_events_total{tenant_id="${escapeLabel(tenantId)}",outcome="${outcome}"} ${metrics.events[outcome]}`);
      }
    }

    lines.push(
      '# HELP tier_trade_outbox_batch_duration_seconds Duration of outbox batches.',
      '# TYPE tier_trade_outbox_batch_duration_seconds histogram',
    );
    for (const [tenantId, metrics] of this.sortedTenants()) {
      for (const [index, bucket] of durationBuckets.entries()) {
        lines.push(`tier_trade_outbox_batch_duration_seconds_bucket{tenant_id="${escapeLabel(tenantId)}",le="${bucket}"} ${metrics.durationBuckets[index]}`);
      }
      lines.push(`tier_trade_outbox_batch_duration_seconds_bucket{tenant_id="${escapeLabel(tenantId)}",le="+Inf"} ${metrics.durationCount}`);
      lines.push(`tier_trade_outbox_batch_duration_seconds_sum{tenant_id="${escapeLabel(tenantId)}"} ${metrics.durationSum}`);
      lines.push(`tier_trade_outbox_batch_duration_seconds_count{tenant_id="${escapeLabel(tenantId)}"} ${metrics.durationCount}`);
    }

    this.renderGauge(lines, 'tier_trade_outbox_pending_events', 'Current unpublished outbox events.', (metrics) => metrics.pending);
    this.renderGauge(lines, 'tier_trade_outbox_delayed_events', 'Current events waiting for retry.', (metrics) => metrics.delayed);
    this.renderGauge(lines, 'tier_trade_outbox_oldest_pending_age_seconds', 'Age of the oldest unpublished event.', (metrics) => metrics.oldestPendingAgeSeconds);
    this.renderGauge(lines, 'tier_trade_outbox_last_batch_timestamp_seconds', 'Unix timestamp of the last completed batch.', (metrics) => metrics.lastBatchTimestampSeconds);
    return `${lines.join('\n')}\n`;
  }

  private renderGauge(
    lines: string[],
    name: string,
    help: string,
    select: (metrics: TenantMetrics) => number,
  ): void {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
    for (const [tenantId, metrics] of this.sortedTenants()) {
      if (!metrics.queueObserved) continue;
      lines.push(`${name}{tenant_id="${escapeLabel(tenantId)}"} ${select(metrics)}`);
    }
  }

  private sortedTenants(): Array<[string, TenantMetrics]> {
    return [...this.tenants.entries()].sort(([left], [right]) => left.localeCompare(right));
  }

  private forTenant(tenantId: string): TenantMetrics {
    const current = this.tenants.get(tenantId);
    if (current) return current;
    const created: TenantMetrics = {
      batches: { success: 0, partial_failure: 0, error: 0 },
      events: { claimed: 0, published: 0, failed: 0, recovered: 0, retry_scheduled: 0 },
      durationBuckets: durationBuckets.map(() => 0),
      durationCount: 0,
      durationSum: 0,
      pending: 0,
      delayed: 0,
      oldestPendingAgeSeconds: 0,
      lastBatchTimestampSeconds: 0,
      queueObserved: false,
    };
    this.tenants.set(tenantId, created);
    return created;
  }
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}
