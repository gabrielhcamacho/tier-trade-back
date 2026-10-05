import { z } from 'zod';

const positiveDecimal = z.string()
  .regex(/^\d+(?:\.\d{1,6})?$/, 'Expected a positive decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');
const date = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const reason = z.string().trim().min(5).max(1000);

export const salesContractSchema = z.object({
  counterpartyId: z.uuid(),
  reference: z.string().trim().min(3).max(40),
  commodity: z.enum(['MILHO', 'SOJA']),
  quantityKg: positiveDecimal,
  salePricePerKg: positiveDecimal,
  destinationCode: z.string().trim().toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  deliveryStart: date,
  deliveryEnd: date,
  requiredDocuments: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  paymentTermDays: z.number().int().min(0).max(730).nullable().default(null),
}).refine((value) => value.deliveryEnd >= value.deliveryStart, {
  path: ['deliveryEnd'], message: 'Delivery end must not precede delivery start.',
});

export const allocationSchema = z.object({
  salesContractId: z.uuid(),
  lotId: z.uuid(),
  quantityKg: positiveDecimal,
});

export const dispatchSchema = z.object({
  allocationId: z.uuid(),
  quantityKg: positiveDecimal,
  dispatchedAt: z.iso.datetime({ offset: true }),
  vehiclePlate: z.string().trim()
    .transform((value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)),
  documentReference: z.string().trim().min(1).max(80),
  notes: z.string().trim().min(1).max(1000).nullable(),
});

export const inventoryLocationSchema = z.object({
  code: z.string().trim().toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  name: z.string().trim().min(2).max(120),
});

export const lotClassificationSchema = z.object({
  ownershipStatus: z.enum(['PENDING_DEFINITION', 'OWN', 'THIRD_PARTY']),
  riskStatus: z.enum(['PENDING_DEFINITION', 'ASSUMED', 'NOT_ASSUMED']),
  custodyStatus: z.enum(['IN_STORAGE', 'IN_TRANSIT', 'RELEASED']),
  ownerCounterpartyId: z.uuid().nullable(),
  custodianCounterpartyId: z.uuid().nullable(),
  occurredAt: timestamp,
  reason,
}).superRefine((value, context) => {
  if (value.ownershipStatus === 'THIRD_PARTY' && !value.ownerCounterpartyId) {
    context.addIssue({ code: 'custom', path: ['ownerCounterpartyId'], message: 'Owner is required.' });
  }
});

export const startTransferSchema = z.object({
  destinationLocationId: z.uuid(),
  startedAt: timestamp,
  reason,
});

export const completeTransferSchema = z.object({
  completedAt: timestamp,
  reason,
});

export const lossSchema = z.object({
  quantityKg: positiveDecimal,
  occurredAt: timestamp,
  reason,
});

export const inventoryCountSchema = z.object({
  countedQuantityKg: z.string().regex(/^\d+(?:\.\d{1,3})?$/),
  occurredAt: timestamp,
  reason,
});

export type SalesContractInput = z.infer<typeof salesContractSchema>;
export type AllocationInput = z.infer<typeof allocationSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
export type InventoryLocationInput = z.infer<typeof inventoryLocationSchema>;
export type LotClassificationInput = z.infer<typeof lotClassificationSchema>;
export type StartTransferInput = z.infer<typeof startTransferSchema>;
export type CompleteTransferInput = z.infer<typeof completeTransferSchema>;
export type LossInput = z.infer<typeof lossSchema>;
export type InventoryCountInput = z.infer<typeof inventoryCountSchema>;
