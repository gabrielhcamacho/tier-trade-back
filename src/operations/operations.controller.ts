import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { OperationsService } from './operations.service.js';
import { scheduleLoadSchema, type ScheduleLoadInput } from './operations.schemas.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1')
export class OperationsController {
  constructor(@Inject(OperationsService) private readonly service: OperationsService) {}

  @Post('contracts/:contractId/loads')
  schedule(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body(new SchemaPipe(scheduleLoadSchema)) input: ScheduleLoadInput) {
    return this.service.scheduleLoad(identity.tenantId, identity.actorId, contractId, input);
  }

  @Get('contracts/:contractId/loads')
  list(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.service.listContractLoads(identity.tenantId, identity.actorId, contractId);
  }

  @Get('loads/:loadId')
  detail(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string) {
    return this.service.loadDetail(identity.tenantId, identity.actorId, loadId);
  }
}
