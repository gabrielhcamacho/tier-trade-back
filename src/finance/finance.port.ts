import type { PoolClient } from 'pg';

export type ProjectSalesDispatchInput = {
  tenantId: string;
  actorId: string;
  dispatchId: string;
};

export type ProjectPurchaseReceiptInput = {
  tenantId: string;
  actorId: string;
  receiptId: string;
};

export type IssuePurchasePayableInput = {
  tenantId: string;
  actorId: string;
  financialEventId: string;
  fiscalDocumentId: string;
  titleNumber: string;
  documentReference: string;
  dueDate: string;
};

export type ApplyFiscalObligationInput = {
  tenantId: string;
  actorId: string;
  obligationId: string;
  sourceFinancialEventId: string | null;
  authorityId: string;
  authorityName: string;
  tax: string;
  amount: string;
  competenceDate: string;
  dueDate: string;
  titleEffect: 'NONE' | 'REDUCE_SOURCE_TITLE';
  paymentResponsibility: 'TENANT' | 'COUNTERPARTY';
  titleNumber: string | null;
  documentReference: string | null;
};

export abstract class FinancialProjectionPort {
  abstract projectSalesDispatch(
    client: PoolClient,
    input: ProjectSalesDispatchInput,
  ): Promise<{ financialEventId: string; calculationStatus: string }>;

  abstract projectPurchaseReceipt(
    client: PoolClient,
    input: ProjectPurchaseReceiptInput,
  ): Promise<{ financialEventId: string; calculationStatus: string; expectedAmount: string | null }>;

  abstract issuePurchasePayable(
    client: PoolClient,
    input: IssuePurchasePayableInput,
  ): Promise<{ titleId: string; amount: string }>;

  abstract applyFiscalObligation(
    client: PoolClient,
    input: ApplyFiscalObligationInput,
  ): Promise<{ payableEventId: string | null; payableTitleId: string | null; adjustmentId: string | null }>;
}
