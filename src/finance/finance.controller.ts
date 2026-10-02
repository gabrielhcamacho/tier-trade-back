import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  createTitleSchema,
  reverseSettlementSchema,
  settleTitleSchema,
  type CreateTitleInput,
  type ReverseSettlementInput,
  type SettleTitleInput,
} from './finance.schemas.js';
import { FinanceService } from './finance.service.js';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/finance')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly service: FinanceService) {}

  @Get()
  workspace(@Identity() identity: RequestIdentity) {
    return this.service.workspace(identity.tenantId, identity.actorId);
  }

  @Post('titles')
  createTitle(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createTitleSchema)) input: CreateTitleInput) {
    return this.service.createTitle(identity.tenantId, identity.actorId, input);
  }

  @Post('titles/:titleId/settlements')
  settle(@Identity() identity: RequestIdentity,
    @Param('titleId', ParseUUIDPipe) titleId: string,
    @Body(new SchemaPipe(settleTitleSchema)) input: SettleTitleInput) {
    return this.service.settle(identity.tenantId, identity.actorId, titleId, input);
  }

  @Post('settlements/:settlementId/reverse')
  reverse(@Identity() identity: RequestIdentity,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @Body(new SchemaPipe(reverseSettlementSchema)) input: ReverseSettlementInput) {
    return this.service.reverseSettlement(identity.tenantId, identity.actorId, settlementId, input);
  }
}
