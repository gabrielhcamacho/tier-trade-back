import type { PoolClient } from 'pg';

export type ApplyReceiptToInventoryInput = {
  tenantId: string;
  actorId: string;
  loadId: string;
  contractId: string;
  destinationCode: string;
  receiptId: string;
  receivedAt: Date;
  previousAcceptedWeightKg: string;
  nextAcceptedWeightKg: string;
};

export abstract class InventoryReceiptPort {
  abstract applyReceipt(
    client: PoolClient,
    input: ApplyReceiptToInventoryInput,
  ): Promise<void>;
}
