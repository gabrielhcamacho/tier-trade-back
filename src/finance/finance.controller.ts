import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { SchemaPipe } from '../common/schema.pipe.js';
import {
  configureFinancePolicySchema,
  createBankAccountSchema,
  createBankStatementEntrySchema,
  createPaymentBatchSchema,
  createPurchaseCostComponentSchema,
  createTitleSchema,
  payTitleSchema,
  reconcileBankStatementEntrySchema,
  reverseSettlementSchema,
  settleTitleSchema,
  type ConfigureFinancePolicyInput,
  type CreateBankAccountInput,
  type CreateBankStatementEntryInput,
  type CreatePaymentBatchInput,
  type CreatePurchaseCostComponentInput,
  type CreateTitleInput,
  type PayTitleInput,
  type ReconcileBankStatementEntryInput,
  type ReverseSettlementInput,
  type SettleTitleInput,
} from './finance.schemas.js';
import { FinanceGovernanceService } from './finance-governance.service.js';
import { FinanceService } from './finance.service.js';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/finance')
export class FinanceController {
  constructor(
    @Inject(FinanceService) private readonly service: FinanceService,
    @Inject(FinanceGovernanceService) private readonly governance: FinanceGovernanceService,
  ) {}

  @Get()
  async workspace(@Identity() identity: RequestIdentity) {
    const [finance, governance] = await Promise.all([
      this.service.workspace(identity.tenantId, identity.actorId),
      this.governance.workspace(identity.tenantId, identity.actorId),
    ]);
    return { ...finance, governance };
  }

  @Post('purchase-cost-components')
  createPurchaseCostComponent(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createPurchaseCostComponentSchema)) input: CreatePurchaseCostComponentInput) {
    return this.governance.createPurchaseCostComponent(identity.tenantId, identity.actorId, input);
  }

  @Post('purchase-cost-components/:componentId/reverse')
  reversePurchaseCostComponent(@Identity() identity: RequestIdentity,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body(new SchemaPipe(reverseSettlementSchema)) input: ReverseSettlementInput) {
    return this.governance.reversePurchaseCostComponent(identity.tenantId, identity.actorId, componentId, input);
  }

  @Post('policies')
  configurePolicy(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(configureFinancePolicySchema)) input: ConfigureFinancePolicyInput) {
    return this.governance.configurePolicy(identity.tenantId, identity.actorId, input);
  }

  @Post('payment-batches')
  createPaymentBatch(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createPaymentBatchSchema)) input: CreatePaymentBatchInput) {
    return this.governance.createPaymentBatch(identity.tenantId, identity.actorId, input);
  }

  @Post('payment-batches/:batchId/submit')
  submitPaymentBatch(@Identity() identity: RequestIdentity,
    @Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.governance.submitPaymentBatch(identity.tenantId, identity.actorId, batchId);
  }

  @Post('payment-batches/:batchId/approve')
  approvePaymentBatch(@Identity() identity: RequestIdentity,
    @Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.governance.approvePaymentBatch(identity.tenantId, identity.actorId, batchId);
  }

  @Post('payment-batches/:batchId/execute')
  executePaymentBatch(@Identity() identity: RequestIdentity,
    @Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.governance.executePaymentBatch(identity.tenantId, identity.actorId, batchId);
  }

  @Post('bank-accounts')
  createBankAccount(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createBankAccountSchema)) input: CreateBankAccountInput) {
    return this.governance.createBankAccount(identity.tenantId, identity.actorId, input);
  }

  @Post('bank-statement-entries')
  createBankStatementEntry(@Identity() identity: RequestIdentity,
    @Body(new SchemaPipe(createBankStatementEntrySchema)) input: CreateBankStatementEntryInput) {
    return this.governance.createBankStatementEntry(identity.tenantId, identity.actorId, input);
  }

  @Post('bank-statement-entries/:entryId/reconcile')
  reconcileBankStatementEntry(@Identity() identity: RequestIdentity,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body(new SchemaPipe(reconcileBankStatementEntrySchema)) input: ReconcileBankStatementEntryInput) {
    return this.governance.reconcileBankStatementEntry(identity.tenantId, identity.actorId, entryId, input);
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

  @Post('titles/:titleId/payments')
  pay(@Identity() identity: RequestIdentity,
    @Param('titleId', ParseUUIDPipe) titleId: string,
    @Body(new SchemaPipe(payTitleSchema)) input: PayTitleInput) {
    return this.service.pay(identity.tenantId, identity.actorId, titleId, input);
  }

  @Post('payments/:paymentId/reverse')
  reversePayment(@Identity() identity: RequestIdentity,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body(new SchemaPipe(reverseSettlementSchema)) input: ReverseSettlementInput) {
    return this.service.reversePayment(identity.tenantId, identity.actorId, paymentId, input);
  }
}
