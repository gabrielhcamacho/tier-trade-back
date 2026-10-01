import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { DevelopmentIdentityGuard } from '../common/identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { createOfferSchema, type CreateOfferInput } from './commercial.schemas.js';
import { CommercialService } from './commercial.service.js';

@ApiTags('commercial')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Development only; replaced by trusted identity.' })
@ApiHeader({ name: 'x-actor-id', required: true, description: 'Development only; replaced by trusted identity.' })
@UseGuards(DevelopmentIdentityGuard)
@Controller('v1')
export class CommercialController {
  constructor(private readonly service: CommercialService) {}

  @Post('offers')
  create(@Headers('x-tenant-id') tenantId: string, @Headers('x-actor-id') actorId: string,
    @Body(new SchemaPipe(createOfferSchema)) input: CreateOfferInput) {
    return this.service.createOffer(tenantId, actorId, input);
  }

  @Post('offers/:offerId/submit')
  submit(@Headers('x-tenant-id') tenantId: string, @Headers('x-actor-id') actorId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.service.submitOffer(tenantId, actorId, offerId);
  }

  @Post('approvals/:approvalId/approve')
  approve(@Headers('x-tenant-id') tenantId: string, @Headers('x-actor-id') actorId: string,
    @Param('approvalId', ParseUUIDPipe) approvalId: string) {
    return this.service.approve(tenantId, actorId, approvalId);
  }

  @Post('offers/:offerId/activate-contract')
  activate(@Headers('x-tenant-id') tenantId: string, @Headers('x-actor-id') actorId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.service.activateContract(tenantId, actorId, offerId);
  }

  @Get('contracts/:contractId/summary')
  summary(@Headers('x-tenant-id') tenantId: string, @Headers('x-actor-id') actorId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.service.contractSummary(tenantId, actorId, contractId);
  }
}
