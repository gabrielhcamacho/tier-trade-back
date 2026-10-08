import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { parseWorkerEnvironment } from '../config/runtime-environment.js';
import { DashboardProcessor } from '../dashboard/dashboard.processor.js';
import { DashboardRefreshService } from '../dashboard/dashboard-refresh.service.js';
import { OutboxMetrics } from '../observability/metrics.js';
import { OutboxProcessor } from './outbox.processor.js';
import { closeServer, startWorkerObservabilityServer, WorkerHealth } from './worker-health.js';

async function run() {
  const configuration = parseWorkerEnvironment(process.env);
  const application = await NestFactory.createApplicationContext(AppModule);
  const processor = application.get(OutboxProcessor);
  const dashboardProcessor = application.get(DashboardProcessor);
  const dashboardRefresh = application.get(DashboardRefreshService);
  const metrics = application.get(OutboxMetrics);
  const workerId = randomUUID();
  const health = new WorkerHealth(configuration.OUTBOX_HEALTH_STALE_AFTER_MS);
  const observabilityServer = await startWorkerObservabilityServer({
    port: configuration.OUTBOX_OBSERVABILITY_PORT,
    tenantId: configuration.TENANT_ID ?? 'multi-tenant',
    metrics,
    health,
  });
  let stopping = false;
  let tenantCursor: string | null = null;

  const stop = () => {
    stopping = true;
    health.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      const tenantIds: string[] = configuration.TENANT_ID
        ? [configuration.TENANT_ID]
        : await dashboardRefresh.listActiveTenants(tenantCursor, configuration.WORKER_TENANT_BATCH_SIZE);
      if (tenantIds.length === 0) {
        tenantCursor = null;
        await new Promise((resolve) => setTimeout(resolve, configuration.OUTBOX_POLL_INTERVAL_MS));
        continue;
      }
      let workClaimed = 0;
      for (const tenantId of tenantIds) {
        await dashboardRefresh.ensureMissingSnapshots(tenantId);
        const outbox = await processor.processTenant(tenantId, workerId, configuration.OUTBOX_BATCH_SIZE);
        const dashboards = await dashboardProcessor.processTenant(
          tenantId,
          workerId,
          configuration.DASHBOARD_REFRESH_BATCH_SIZE,
        );
        health.batchCompleted({ ...outbox, failed: outbox.failed + dashboards.failed });
        workClaimed += outbox.claimed + dashboards.claimed;
      }
      if (!configuration.TENANT_ID) tenantCursor = tenantIds.at(-1) ?? null;
      if (configuration.TENANT_ID && workClaimed === 0) {
        await new Promise((resolve) => setTimeout(resolve, configuration.OUTBOX_POLL_INTERVAL_MS));
      }
    }
  } finally {
    await closeServer(observabilityServer);
    await application.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown worker error';
  console.error(JSON.stringify({ event: 'outbox.worker.stopped', error: message }));
  process.exitCode = 1;
});
