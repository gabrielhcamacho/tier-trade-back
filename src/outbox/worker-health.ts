import { createServer, type Server } from 'node:http';
import type { OutboxMetrics } from '../observability/metrics.js';
import type { OutboxBatchResult } from './outbox.processor.js';

export class WorkerHealth {
  private readonly startedAt = Date.now();
  private lastBatchAt: number | null = null;
  private lastBatchFailed = 0;
  private stopping = false;

  constructor(private readonly staleAfterMs: number) {}

  batchCompleted(result: OutboxBatchResult): void {
    this.lastBatchAt = Date.now();
    this.lastBatchFailed = result.failed;
  }

  stop(): void {
    this.stopping = true;
  }

  snapshot(now = Date.now()) {
    const lastBatchAgeMs = this.lastBatchAt === null ? null : Math.max(0, now - this.lastBatchAt);
    const stale = lastBatchAgeMs !== null && lastBatchAgeMs > this.staleAfterMs;
    const ready = !this.stopping && this.lastBatchAt !== null && !stale;
    const status = this.stopping
      ? 'stopping'
      : this.lastBatchAt === null
        ? 'starting'
        : stale
          ? 'stale'
          : this.lastBatchFailed > 0
            ? 'degraded'
            : 'ready';
    return {
      status,
      ready,
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      lastBatchAgeSeconds: lastBatchAgeMs === null ? null : Math.floor(lastBatchAgeMs / 1000),
      lastBatchFailed: this.lastBatchFailed,
    };
  }
}

export async function startWorkerObservabilityServer(options: {
  port: number;
  tenantId: string;
  metrics: OutboxMetrics;
  health: WorkerHealth;
}): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405).end();
      return;
    }
    if (request.url === '/health/live') {
      respondJson(response, 200, { status: 'ok' });
      return;
    }
    if (request.url === '/health/ready') {
      const snapshot = options.health.snapshot();
      respondJson(response, snapshot.ready ? 200 : 503, snapshot);
      return;
    }
    if (request.url === '/metrics') {
      const snapshot = options.health.snapshot();
      const tenantId = escapeLabel(options.tenantId);
      response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
      response.end(
        `${options.metrics.render()}# HELP tier_trade_outbox_worker_ready Whether the worker loop is current and ready.\n` +
        `# TYPE tier_trade_outbox_worker_ready gauge\n` +
        `tier_trade_outbox_worker_ready{tenant_id="${tenantId}"} ${snapshot.ready ? 1 : 0}\n`,
      );
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function respondJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}
