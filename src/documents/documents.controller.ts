import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { createUploadRequestSchema, signatureSchema,
  type CreateUploadRequestInput, type SignatureInput } from './documents.schemas.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly service: DocumentsService) {}

  @Get()
  list(@Identity() identity: RequestIdentity,
    @Query('aggregateType') aggregateType?: string, @Query('aggregateId') aggregateId?: string) {
    return this.service.list(identity.tenantId, identity.actorId, aggregateType, aggregateId);
  }

  @Post('upload-request')
  createUploadRequest(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createUploadRequestSchema)) input: CreateUploadRequestInput) {
    return this.service.createUploadRequest(identity.tenantId, identity.actorId, input);
  }

  @Post(':documentId/complete')
  complete(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.service.completeUpload(identity.tenantId, identity.actorId, documentId);
  }

  @Get(':documentId/download')
  download(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.service.download(identity.tenantId, identity.actorId, documentId);
  }

  @Post(':documentId/signatures')
  addSignature(@Identity() identity: RequestIdentity,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body(new SchemaPipe(signatureSchema)) input: SignatureInput) {
    return this.service.addSignature(identity.tenantId, identity.actorId, documentId, input);
  }
}
