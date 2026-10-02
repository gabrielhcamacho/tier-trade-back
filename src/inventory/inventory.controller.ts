import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}

  @Get()
  position(@Identity() identity: RequestIdentity) {
    return this.service.position(identity.tenantId, identity.actorId);
  }
}
