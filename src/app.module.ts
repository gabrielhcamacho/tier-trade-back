import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';
import { HealthModule } from './health/health.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { AccessModule } from './control-plane/access.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { RiskModule } from './risk/risk.module.js';
import { FiscalModule } from './fiscal/fiscal.module.js';
import { OverviewModule } from './overview/overview.module.js';
import { DocumentsModule } from './documents/documents.module.js';

@Module({
  imports: [AccessModule, CommercialModule, DocumentsModule, FinanceModule, FiscalModule, HealthModule, InventoryModule,
    OperationsModule, OutboxModule, RiskModule, OverviewModule],
})
export class AppModule {}
