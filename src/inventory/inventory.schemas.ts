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

export const salesContractStatusTransitionSchema = z.object({
  status: z.enum(['AWAITING_SIGNATURE', 'SIGNED', 'ACTIVE', 'CLOSED', 'CANCELLED']),
  reason: z.string().trim().min(3).max(500).nullable().default(null),
});

export const salesContractAmendmentSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  effectiveOn: date,
  terms: salesContractSchema,
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

export const destinationReceiptSchema = z.object({
  destinationWeightKg: positiveDecimal,
  unloadedAt: timestamp,
  terminalCode: z.string().trim().toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  ticketReference: z.string().trim().min(1).max(80),
  destinationDocumentReference: z.string().trim().min(1).max(80).nullable(),
  reason,
  notes: z.string().trim().min(1).max(1000).nullable(),
});

export const deliveryRequirementPolicySchema = z.object({
  counterpartyId: z.uuid(),
  terminalCode: z.string().trim().toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  requirementType: z.enum(['DESTINATION_TICKET', 'PORTAL_CONFIRMATION']),
  title: z.string().trim().min(3).max(160),
  responsibleName: z.string().trim().min(2).max(120),
  dueHoursAfterDispatch: z.number().int().min(0).max(720),
  portalName: z.string().trim().min(2).max(120).nullable(),
  portalUrl: z.url().max(500).nullable(),
  consequence: z.enum(['INFORMATIONAL', 'BLOCK_OPERATIONAL_CLOSURE', 'BLOCK_ANTICIPATION']),
});

export const updateDeliveryRequirementSchema = z.object({
  status: z.enum(['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAIVED']),
  evidenceReference: z.string().trim().min(1).max(160).nullable(),
  portalConfirmation: z.string().trim().min(1).max(160).nullable(),
  notes: z.string().trim().min(1).max(1000).nullable(),
  reason,
}).superRefine((value, context) => {
  if (value.status === 'SUBMITTED' && !value.evidenceReference && !value.portalConfirmation) {
    context.addIssue({ code: 'custom', path: ['evidenceReference'], message: 'Informe a evidência ou a confirmação do portal.' });
  }
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
export type SalesContractStatusTransitionInput = z.infer<typeof salesContractStatusTransitionSchema>;
export type SalesContractAmendmentInput = z.infer<typeof salesContractAmendmentSchema>;
export type AllocationInput = z.infer<typeof allocationSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
export type DestinationReceiptInput = z.infer<typeof destinationReceiptSchema>;
export type DeliveryRequirementPolicyInput = z.infer<typeof deliveryRequirementPolicySchema>;
export type UpdateDeliveryRequirementInput = z.infer<typeof updateDeliveryRequirementSchema>;
export type InventoryLocationInput = z.infer<typeof inventoryLocationSchema>;
export type LotClassificationInput = z.infer<typeof lotClassificationSchema>;
export type StartTransferInput = z.infer<typeof startTransferSchema>;
export type CompleteTransferInput = z.infer<typeof completeTransferSchema>;
export type LossInput = z.infer<typeof lossSchema>;
export type InventoryCountInput = z.infer<typeof inventoryCountSchema>;
