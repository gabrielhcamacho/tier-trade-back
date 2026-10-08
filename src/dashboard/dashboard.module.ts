import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardProcessor } from './dashboard.processor.js';
import { DashboardQueryService } from './dashboard-query.service.js';
import { DashboardRefreshService } from './dashboard-refresh.service.js';
import { DashboardSnapshotBuilder } from './dashboard-snapshot.builder.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardProcessor, DashboardQueryService, DashboardRefreshService, DashboardSnapshotBuilder],
  exports: [DashboardProcessor, DashboardQueryService, DashboardRefreshService],
})
export class DashboardModule {}
