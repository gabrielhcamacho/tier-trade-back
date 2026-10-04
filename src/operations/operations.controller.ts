import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { OperationsService } from './operations.service.js';
import {
  cancelLoadSchema,
  recordLoadReceiptSchema,
  rescheduleLoadSchema,
  scheduleLoadSchema,
  type CancelLoadInput,
  type RecordLoadReceiptInput,
  type RescheduleLoadInput,
  type ScheduleLoadInput,
} from './operations.schemas.js';

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

  @Post('loads/:loadId/start-receiving')
  startReceiving(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string) {
    return this.service.startReceiving(identity.tenantId, identity.actorId, loadId);
  }

  @Put('loads/:loadId/schedule')
  reschedule(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Body(new SchemaPipe(rescheduleLoadSchema)) input: RescheduleLoadInput) {
    return this.service.rescheduleLoad(identity.tenantId, identity.actorId, loadId, input);
  }

  @Post('loads/:loadId/cancel')
  cancel(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Body(new SchemaPipe(cancelLoadSchema)) input: CancelLoadInput) {
    return this.service.cancelLoad(identity.tenantId, identity.actorId, loadId, input);
  }

  @Put('loads/:loadId/receipt')
  recordReceipt(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Body(new SchemaPipe(recordLoadReceiptSchema)) input: RecordLoadReceiptInput) {
    return this.service.recordReceipt(identity.tenantId, identity.actorId, loadId, input);
  }
}
