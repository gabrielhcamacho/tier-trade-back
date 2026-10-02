import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { RiskController } from './risk.controller.js';
import { RiskService } from './risk.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
