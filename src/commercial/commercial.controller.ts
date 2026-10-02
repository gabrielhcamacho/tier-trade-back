import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  cancelOfferSchema,
  createCounterpartySchema,
  createOfferSchema,
  marginPolicySchema,
  type CancelOfferInput,
  type CreateCounterpartyInput,
  type CreateOfferInput,
  type MarginPolicyInput,
} from './commercial.schemas.js';
import { CommercialService } from './commercial.service.js';

@ApiTags('commercial')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1')
export class CommercialController {
  constructor(@Inject(CommercialService) private readonly service: CommercialService) {}

  @Get('counterparties')
  counterparties(@Identity() identity: RequestIdentity) {
    return this.service.listCounterparties(identity.tenantId, identity.actorId);
  }

  @Post('counterparties')
  createCounterparty(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createCounterpartySchema)) input: CreateCounterpartyInput) {
    return this.service.createCounterparty(identity.tenantId, identity.actorId, input);
  }

  @Post('offers')
  create(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createOfferSchema)) input: CreateOfferInput) {
    return this.service.createOffer(identity.tenantId, identity.actorId, input);
  }

  @Put('offers/:offerId')
  update(@Identity() identity: RequestIdentity, @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body(new SchemaPipe(createOfferSchema)) input: CreateOfferInput) {
    return this.service.updateOffer(identity.tenantId, identity.actorId, offerId, input);
  }

  @Post('offers/:offerId/cancel')
  cancel(@Identity() identity: RequestIdentity, @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body(new SchemaPipe(cancelOfferSchema)) input: CancelOfferInput) {
    return this.service.cancelOffer(identity.tenantId, identity.actorId, offerId, input);
  }

  @Post('offers/:offerId/submit')
  submit(@Identity() identity: RequestIdentity,
    @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.service.submitOffer(identity.tenantId, identity.actorId, offerId);
  }

  @Post('approvals/:approvalId/approve')
  approve(@Identity() identity: RequestIdentity,
    @Param('approvalId', ParseUUIDPipe) approvalId: string) {
    return this.service.approve(identity.tenantId, identity.actorId, approvalId);
  }

  @Post('offers/:offerId/activate-contract')
  activate(@Identity() identity: RequestIdentity,
    @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.service.activateContract(identity.tenantId, identity.actorId, offerId);
  }

  @Get('contracts')
  contracts(@Identity() identity: RequestIdentity) {
    return this.service.listContracts(identity.tenantId, identity.actorId);
  }

  @Get('contracts/:contractId/summary')
  summary(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.service.contractSummary(identity.tenantId, identity.actorId, contractId);
  }

  @Get('settings/margin-policy/MILHO')
  policy(@Identity() identity: RequestIdentity) {
    return this.service.currentMarginPolicy(identity.tenantId, identity.actorId, 'MILHO');
  }

  @Patch('settings/margin-policy')
  configurePolicy(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(marginPolicySchema)) input: MarginPolicyInput) {
    return this.service.configureMarginPolicy(identity.tenantId, identity.actorId, input);
  }
}
