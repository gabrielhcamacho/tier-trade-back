import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { FinanceController } from './finance.controller.js';
import { FinanceGovernanceService } from './finance-governance.service.js';
import { FinancialProjectionPort } from './finance.port.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceGovernanceService,
    { provide: FinancialProjectionPort, useExisting: FinanceService }],
  exports: [FinancialProjectionPort, FinanceService, FinanceGovernanceService],
})
export class FinanceModule {}
