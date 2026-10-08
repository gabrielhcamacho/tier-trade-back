import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { OutboxMetrics } from '../observability/metrics.js';
import { StructuredLogger } from '../observability/structured-logger.js';
import { OutboxObservability } from './outbox.observability.js';
import { OutboxProcessor } from './outbox.processor.js';

@Module({
  imports: [DatabaseModule, DashboardModule],
  providers: [OutboxMetrics, StructuredLogger, OutboxObservability, OutboxProcessor],
  exports: [OutboxMetrics, StructuredLogger, OutboxProcessor],
})
export class OutboxModule {}
