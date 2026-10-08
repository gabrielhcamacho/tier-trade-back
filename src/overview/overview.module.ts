import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { OverviewController } from './overview.controller.js';

@Module({
  imports: [AuthModule, DashboardModule],
  controllers: [OverviewController],
})
export class OverviewModule {}
