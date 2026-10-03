import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { FinanceModule } from '../finance/finance.module.js';
import { FiscalController } from './fiscal.controller.js';
import { FiscalService } from './fiscal.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, FinanceModule],
  controllers: [FiscalController],
  providers: [FiscalService],
})
export class FiscalModule {}
