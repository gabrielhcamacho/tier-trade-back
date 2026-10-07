import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  allocationSchema,
  completeTransferSchema,
  dispatchSchema,
  inventoryCountSchema,
  inventoryLocationSchema,
  lossSchema,
  lotClassificationSchema,
  salesContractSchema,
  salesContractStatusTransitionSchema,
  salesContractAmendmentSchema,
  startTransferSchema,
  type AllocationInput,
  type CompleteTransferInput,
  type DispatchInput,
  type InventoryCountInput,
  type InventoryLocationInput,
  type LossInput,
  type LotClassificationInput,
  type SalesContractInput,
  type SalesContractStatusTransitionInput,
  type SalesContractAmendmentInput,
  type StartTransferInput,
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

  @Get('sales-contracts')
  salesPortfolio(@Identity() identity: RequestIdentity) {
    return this.service.salesPortfolio(identity.tenantId, identity.actorId);
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

  @Post('sales-contracts/:contractId/transition')
  transitionSalesContract(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body(new SchemaPipe(salesContractStatusTransitionSchema)) input: SalesContractStatusTransitionInput) {
    return this.service.transitionSalesContract(identity.tenantId, identity.actorId, contractId, input);
  }

  @Post('sales-contracts/:contractId/amendments')
  amendSalesContract(@Identity() identity: RequestIdentity,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body(new SchemaPipe(salesContractAmendmentSchema)) input: SalesContractAmendmentInput) {
    return this.service.amendSalesContract(identity.tenantId, identity.actorId, contractId, input);
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

  @Post('locations')
  createLocation(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(inventoryLocationSchema)) input: InventoryLocationInput) {
    return this.service.createLocation(identity.tenantId, identity.actorId, input);
  }

  @Put('lots/:lotId/classification')
  classifyLot(@Identity() identity: RequestIdentity,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body(new SchemaPipe(lotClassificationSchema)) input: LotClassificationInput) {
    return this.service.classifyLot(identity.tenantId, identity.actorId, lotId, input);
  }

  @Post('lots/:lotId/transfers')
  startTransfer(@Identity() identity: RequestIdentity,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body(new SchemaPipe(startTransferSchema)) input: StartTransferInput) {
    return this.service.startTransfer(identity.tenantId, identity.actorId, lotId, input);
  }

  @Post('transfers/:transferId/complete')
  completeTransfer(@Identity() identity: RequestIdentity,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body(new SchemaPipe(completeTransferSchema)) input: CompleteTransferInput) {
    return this.service.completeTransfer(identity.tenantId, identity.actorId, transferId, input);
  }

  @Post('lots/:lotId/losses')
  recordLoss(@Identity() identity: RequestIdentity,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body(new SchemaPipe(lossSchema)) input: LossInput) {
    return this.service.recordLoss(identity.tenantId, identity.actorId, lotId, input);
  }

  @Post('lots/:lotId/counts')
  reconcileCount(@Identity() identity: RequestIdentity,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body(new SchemaPipe(inventoryCountSchema)) input: InventoryCountInput) {
    return this.service.reconcileCount(identity.tenantId, identity.actorId, lotId, input);
  }
}
