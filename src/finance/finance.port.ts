import type { PoolClient } from 'pg';

export type ProjectSalesDispatchInput = {
  tenantId: string;
  actorId: string;
  dispatchId: string;
};

export abstract class FinancialProjectionPort {
  abstract projectSalesDispatch(
    client: PoolClient,
    input: ProjectSalesDispatchInput,
  ): Promise<{ financialEventId: string; calculationStatus: string }>;
}
