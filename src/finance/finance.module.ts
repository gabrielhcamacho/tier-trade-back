import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { FinanceController } from './finance.controller.js';
import { FinancialProjectionPort } from './finance.port.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FinanceController],
  providers: [FinanceService, { provide: FinancialProjectionPort, useExisting: FinanceService }],
  exports: [FinancialProjectionPort, FinanceService],
})
export class FinanceModule {}
