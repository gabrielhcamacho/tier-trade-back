import type { PoolClient } from 'pg';

export type ProjectSalesDispatchInput = {
  tenantId: string;
  actorId: string;
  dispatchId: string;
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

  abstract applyFiscalObligation(
    client: PoolClient,
    input: ApplyFiscalObligationInput,
  ): Promise<{ payableEventId: string | null; payableTitleId: string | null; adjustmentId: string | null }>;
}
