import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { FiscalController } from './fiscal.controller.js';
import { FiscalService } from './fiscal.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FiscalController],
  providers: [FiscalService],
})
export class FiscalModule {}
