import { Inject, Injectable } from '@nestjs/common';
import { OutboxMetrics } from '../observability/metrics.js';
import { safeErrorCode, StructuredLogger } from '../observability/structured-logger.js';

export interface OutboxQueueSnapshot {
  pending: number;
  delayed: number;
  oldestPendingAgeSeconds: number;
}

@Injectable()
export class OutboxObservability {
  constructor(
    @Inject(OutboxMetrics) private readonly metrics: OutboxMetrics,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  claimed(tenantId: string, count: number): void {
    this.metrics.recordEvents(tenantId, 'claimed', count);
  }

  published(tenantId: string, eventType: string, eventId: string, attempt: number): void {
    this.metrics.recordEvents(tenantId, 'published');
    if (attempt > 1) this.metrics.recordEvents(tenantId, 'recovered');
    this.logger.info(attempt > 1 ? 'outbox.event.recovered' : 'outbox.event.published', {
      tenant_id: tenantId,
      event_id: eventId,
      event_type: eventType,
      attempt,
    });
  }

  failed(tenantId: string, eventType: string, eventId: string, attempt: number, error: unknown): void {
    this.metrics.recordEvents(tenantId, 'failed');
    this.metrics.recordEvents(tenantId, 'retry_scheduled');
    this.logger.warn('outbox.event.retry_scheduled', {
      tenant_id: tenantId,
      event_id: eventId,
      event_type: eventType,
      attempt,
      error_code: safeErrorCode(error),
    });
  }

  batch(
    tenantId: string,
    workerId: string,
    result: { claimed: number; published: number; failed: number; recovered: number },
    durationMs: number,
    queue: OutboxQueueSnapshot,
  ): void {
    const outcome = result.failed > 0 ? 'partial_failure' : 'success';
    this.metrics.recordBatch(tenantId, outcome, durationMs / 1000, queue);
    this.logger.info('outbox.batch.completed', {
      tenant_id: tenantId,
      worker_id: workerId,
      outcome,
      duration_ms: durationMs,
      pending: queue.pending,
      delayed: queue.delayed,
      oldest_pending_age_seconds: queue.oldestPendingAgeSeconds,
      ...result,
    });
  }

  batchError(tenantId: string, workerId: string, durationMs: number, error: unknown): void {
    this.metrics.recordBatch(tenantId, 'error', durationMs / 1000);
    this.logger.error('outbox.batch.error', {
      tenant_id: tenantId,
      worker_id: workerId,
      duration_ms: durationMs,
      error_code: safeErrorCode(error),
    });
  }
}
