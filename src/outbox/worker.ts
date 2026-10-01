import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppModule } from '../app.module.js';
import { OutboxMetrics } from '../observability/metrics.js';
import { OutboxProcessor } from './outbox.processor.js';
import { closeServer, startWorkerObservabilityServer, WorkerHealth } from './worker-health.js';

const configurationSchema = z.object({
  TENANT_ID: z.uuid(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  OUTBOX_OBSERVABILITY_PORT: z.coerce.number().int().min(1).max(65_535).default(9464),
  OUTBOX_HEALTH_STALE_AFTER_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
});

async function run() {
  const configuration = configurationSchema.parse(process.env);
  const application = await NestFactory.createApplicationContext(AppModule);
  const processor = application.get(OutboxProcessor);
  const metrics = application.get(OutboxMetrics);
  const workerId = randomUUID();
  const health = new WorkerHealth(configuration.OUTBOX_HEALTH_STALE_AFTER_MS);
  const observabilityServer = await startWorkerObservabilityServer({
    port: configuration.OUTBOX_OBSERVABILITY_PORT,
    tenantId: configuration.TENANT_ID,
    metrics,
    health,
  });
  let stopping = false;

  const stop = () => {
    stopping = true;
    health.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      const result = await processor.processTenant(
        configuration.TENANT_ID,
        workerId,
        configuration.OUTBOX_BATCH_SIZE,
      );
      health.batchCompleted(result);
      if (result.claimed === 0) {
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
