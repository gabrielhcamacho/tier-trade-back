import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';
import { HealthModule } from './health/health.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { AccessModule } from './control-plane/access.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { RiskModule } from './risk/risk.module.js';

@Module({
  imports: [AccessModule, CommercialModule, FinanceModule, HealthModule, InventoryModule,
    OperationsModule, OutboxModule, RiskModule],
})
export class AppModule {}
