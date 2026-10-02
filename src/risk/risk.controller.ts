import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { configureRiskPolicySchema, type ConfigureRiskPolicyInput } from './risk.schemas.js';
import { RiskService } from './risk.service.js';

@ApiTags('risk')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/risk')
export class RiskController {
  constructor(@Inject(RiskService) private readonly service: RiskService) {}

  @Get()
  workspace(@Identity() identity: RequestIdentity) {
    return this.service.workspace(identity.tenantId, identity.actorId);
  }

  @Patch('policy')
  configurePolicy(
    @Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(configureRiskPolicySchema)) input: ConfigureRiskPolicyInput,
  ) {
    return this.service.configurePolicy(identity.tenantId, identity.actorId, input);
  }
}
