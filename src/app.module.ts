import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';
import { HealthModule } from './health/health.module.js';
import { OutboxModule } from './outbox/outbox.module.js';

@Module({ imports: [CommercialModule, HealthModule, OutboxModule] })
export class AppModule {}
