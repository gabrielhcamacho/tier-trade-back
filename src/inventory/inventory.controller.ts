import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  allocationSchema,
  dispatchSchema,
  salesContractSchema,
  type AllocationInput,
  type DispatchInput,
  type SalesContractInput,
} from './inventory.schemas.js';
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

  @Post('sales-contracts')
  createSalesContract(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(salesContractSchema)) input: SalesContractInput) {
    return this.service.createSalesContract(identity.tenantId, identity.actorId, input);
  }

  @Put('sales-contracts/:contractId')
  updateSalesContract(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body(new SchemaPipe(salesContractSchema)) input: SalesContractInput) {
    return this.service.updateSalesContract(identity.tenantId, identity.actorId, contractId, input);
  }

  @Get('sales-contracts/:contractId/versions')
  salesContractVersions(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.service.salesContractVersions(identity.tenantId, identity.actorId, contractId);
  }

  @Post('allocations')
  allocate(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(allocationSchema)) input: AllocationInput) {
    return this.service.allocate(identity.tenantId, identity.actorId, input);
  }

  @Post('allocations/:allocationId/release')
  release(@Identity() identity: RequestIdentity,
    @Param('allocationId', ParseUUIDPipe) allocationId: string) {
    return this.service.releaseAllocation(identity.tenantId, identity.actorId, allocationId);
  }

  @Post('dispatches')
  dispatch(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(dispatchSchema)) input: DispatchInput) {
    return this.service.dispatch(identity.tenantId, identity.actorId, input);
  }
}
