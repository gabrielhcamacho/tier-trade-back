import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(?:\.\d{1,6})?$/, 'Expected a non-negative decimal string.');
const localDate = z.iso.date();

export const createOfferSchema = z.object({
  counterpartyId: z.uuid(),
  commodity: z.literal('MILHO'),
  unit: z.literal('SC_60KG'),
  quantitySc: decimalString,
  deliveryStart: localDate,
  deliveryEnd: localDate,
  purchasePricePerSc: decimalString,
  saleReferencePerSc: decimalString,
  costs: z.array(
    z.object({
      code: z.enum(['FREIGHT', 'STORAGE', 'QUALITY', 'FINANCIAL', 'OTHER']),
      amountPerSc: decimalString,
    }),
  ),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const cancelOfferSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const marginPolicySchema = z.object({
  commodity: z.literal('MILHO'),
  autoApprovalMarginPerSc: decimalString,
  absoluteFloorMarginPerSc: decimalString,
});

export type CancelOfferInput = z.infer<typeof cancelOfferSchema>;
export type MarginPolicyInput = z.infer<typeof marginPolicySchema>;
