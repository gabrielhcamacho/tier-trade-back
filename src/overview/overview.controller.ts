import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { OverviewService } from './overview.service.js';

@ApiTags('overview')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/overview')
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly service: OverviewService) {}

  @Get()
  overview(@Identity() identity: RequestIdentity, @Query('commodity') commodity?: string,
    @Query('unit') unit?: string, @Query('crop') crop?: string, @Query('period') period?: string) {
    return this.service.overview(identity.tenantId, identity.actorId, {
      ...(commodity ? { commodity } : {}),
      ...(unit ? { unit } : {}),
      ...(crop ? { crop } : {}),
      ...(period ? { period } : {}),
    });
  }
}
