import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  createFiscalDocumentSchema, rejectFiscalDocumentSchema, updateFiscalDocumentSchema,
  type CreateFiscalDocumentInput, type RejectFiscalDocumentInput, type UpdateFiscalDocumentInput,
} from './fiscal.schemas.js';
import { FiscalService } from './fiscal.service.js';

@ApiTags('fiscal')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/fiscal')
export class FiscalController {
  constructor(@Inject(FiscalService) private readonly service: FiscalService) {}

  @Get()
  workspace(@Identity() identity: RequestIdentity) {
    return this.service.workspace(identity.tenantId, identity.actorId);
  }

  @Post('documents')
  create(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createFiscalDocumentSchema)) input: CreateFiscalDocumentInput) {
    return this.service.create(identity.tenantId, identity.actorId, input);
  }

  @Patch('documents/:documentId')
  update(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body(new SchemaPipe(updateFiscalDocumentSchema)) input: UpdateFiscalDocumentInput) {
    return this.service.update(identity.tenantId, identity.actorId, documentId, input);
  }

  @Post('documents/:documentId/validate')
  validate(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.service.validate(identity.tenantId, identity.actorId, documentId);
  }

  @Post('documents/:documentId/reject')
  reject(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body(new SchemaPipe(rejectFiscalDocumentSchema)) input: RejectFiscalDocumentInput) {
    return this.service.reject(identity.tenantId, identity.actorId, documentId, input);
  }
}
