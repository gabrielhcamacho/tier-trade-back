import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { OperationsService } from './operations.service.js';
import {
  cancelLoadSchema,
  createLoadOccurrenceSchema,
  recordLoadReceiptSchema,
  recordYardEventSchema,
  rescheduleLoadSchema,
  resolveLoadOccurrenceSchema,
  scheduleLoadSchema,
  type CancelLoadInput,
  type CreateLoadOccurrenceInput,
  type RecordLoadReceiptInput,
  type RecordYardEventInput,
  type RescheduleLoadInput,
  type ResolveLoadOccurrenceInput,
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

  @Get('operations/yard')
  yardBoard(@Identity() identity: RequestIdentity) {
    return this.service.yardBoard(identity.tenantId, identity.actorId);
  }

  @Get('operations/occurrences')
  occurrenceBoard(@Identity() identity: RequestIdentity) {
    return this.service.occurrenceBoard(identity.tenantId, identity.actorId);
  }

  @Get('operations/receiving')
  receivingBoard(@Identity() identity: RequestIdentity) {
    return this.service.receivingBoard(identity.tenantId, identity.actorId);
  }

  @Get('operations/quality')
  qualityBoard(@Identity() identity: RequestIdentity) {
    return this.service.qualityBoard(identity.tenantId, identity.actorId);
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

  @Post('loads/:loadId/yard-events')
  recordYardEvent(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Body(new SchemaPipe(recordYardEventSchema)) input: RecordYardEventInput) {
    return this.service.recordYardEvent(identity.tenantId, identity.actorId, loadId, input);
  }

  @Post('loads/:loadId/occurrences')
  createOccurrence(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Body(new SchemaPipe(createLoadOccurrenceSchema)) input: CreateLoadOccurrenceInput) {
    return this.service.createOccurrence(identity.tenantId, identity.actorId, loadId, input);
  }

  @Post('loads/:loadId/occurrences/:occurrenceId/resolve')
  resolveOccurrence(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string,
    @Param('occurrenceId', ParseUUIDPipe) occurrenceId: string,
    @Body(new SchemaPipe(resolveLoadOccurrenceSchema)) input: ResolveLoadOccurrenceInput) {
    return this.service.resolveOccurrence(identity.tenantId, identity.actorId, loadId, occurrenceId, input);
  }

  @Post('loads/:loadId/romaneio')
  issueRomaneio(@Identity() identity: RequestIdentity,
    @Param('loadId', ParseUUIDPipe) loadId: string) {
    return this.service.issueRomaneio(identity.tenantId, identity.actorId, loadId);
  }
}
