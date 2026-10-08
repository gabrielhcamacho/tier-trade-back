import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { DashboardQueryService } from '../dashboard/dashboard-query.service.js';

@ApiTags('overview')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/overview')
export class OverviewController {
  constructor(@Inject(DashboardQueryService) private readonly dashboards: DashboardQueryService) {}

  @Get()
  async overview(@Identity() identity: RequestIdentity) {
    const result = await this.dashboards.one(identity.tenantId, identity.actorId, 'central');
    return result.body;
  }
}
