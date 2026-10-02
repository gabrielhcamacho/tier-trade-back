import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';
import { HealthModule } from './health/health.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { AccessModule } from './control-plane/access.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { InventoryModule } from './inventory/inventory.module.js';

@Module({
  imports: [AccessModule, CommercialModule, HealthModule, InventoryModule, OperationsModule, OutboxModule],
})
export class AppModule {}
