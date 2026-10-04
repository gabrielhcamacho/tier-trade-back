import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CommercialModule } from '../commercial/commercial.module.js';
import { DatabaseModule } from '../database/database.js';
import { FinanceModule } from '../finance/finance.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, CommercialModule, FinanceModule, InventoryModule, RiskModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
