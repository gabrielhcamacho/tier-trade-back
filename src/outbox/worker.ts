import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppModule } from '../app.module.js';
import { OutboxProcessor } from './outbox.processor.js';

const configurationSchema = z.object({
  TENANT_ID: z.uuid(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
});

async function run() {
  const configuration = configurationSchema.parse(process.env);
  const application = await NestFactory.createApplicationContext(AppModule);
  const processor = application.get(OutboxProcessor);
  const workerId = randomUUID();
  let stopping = false;

  const stop = () => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      const result = await processor.processTenant(
        configuration.TENANT_ID,
        workerId,
        configuration.OUTBOX_BATCH_SIZE,
      );
      if (result.failed > 0) console.error(JSON.stringify({ event: 'outbox.batch.failed', ...result }));
      if (result.claimed === 0) {
        await new Promise((resolve) => setTimeout(resolve, configuration.OUTBOX_POLL_INTERVAL_MS));
      }
    }
  } finally {
    await application.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown worker error';
  console.error(JSON.stringify({ event: 'outbox.worker.stopped', error: message }));
  process.exitCode = 1;
});
