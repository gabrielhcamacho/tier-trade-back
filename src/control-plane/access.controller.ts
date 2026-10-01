import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import { createInvitationSchema, type CreateInvitationInput } from './access.schemas.js';
import { AccessService } from './access.service.js';

@ApiTags('access')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1')
export class AccessController {
  constructor(@Inject(AccessService) private readonly service: AccessService) {}

  @Get('session')
  session(@Identity() identity: RequestIdentity) {
    return this.service.session(identity.tenantId, identity.actorId);
  }

  @Post('access/invitations')
  invite(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createInvitationSchema)) input: CreateInvitationInput) {
    return this.service.invite(identity.tenantId, identity.actorId, input);
  }
}
