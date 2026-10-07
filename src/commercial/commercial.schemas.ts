import { z } from 'zod';

const decimalString = z.string().regex(/^\d+(?:\.\d{1,6})?$/, 'Expected a non-negative decimal string.');
const localDate = z.iso.date();
export const commoditySchema = z.enum(['MILHO', 'SOJA']);
export const partyTypeSchema = z.enum(['PERSON', 'COMPANY', 'COOPERATIVE']);

export const createCounterpartySchema = z.object({
  legalName: z.string().trim().min(3).max(200),
  taxId: z.string().trim().transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().min(11).max(14)),
  partyType: partyTypeSchema,
}).superRefine((value, context) => {
  const expectedLength = value.partyType === 'PERSON' ? 11 : 14;
  if (value.taxId.length !== expectedLength) {
    context.addIssue({ code: 'custom', path: ['taxId'], message: 'Tax ID length does not match party type.' });
  }
});

export const updateCounterpartyProfileSchema = z.object({ partyType: partyTypeSchema });

export type CreateCounterpartyInput = z.infer<typeof createCounterpartySchema>;

export const createOfferSchema = z.object({
  counterpartyId: z.uuid(),
  commodity: commoditySchema,
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
  commodity: commoditySchema,
  autoApprovalMarginPerSc: decimalString,
  absoluteFloorMarginPerSc: decimalString,
});

const obligationDetails = {
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(1000).nullable(),
  dueDate: localDate.nullable(),
  responsibleName: z.string().trim().min(2).max(120).nullable(),
};

export const createContractObligationSchema = z.object(obligationDetails);

export const updateContractObligationSchema = z.object({
  ...obligationDetails,
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export type CancelOfferInput = z.infer<typeof cancelOfferSchema>;
export type MarginPolicyInput = z.infer<typeof marginPolicySchema>;
export type UpdateCounterpartyProfileInput = z.infer<typeof updateCounterpartyProfileSchema>;
export type CreateContractObligationInput = z.infer<typeof createContractObligationSchema>;
export type UpdateContractObligationInput = z.infer<typeof updateContractObligationSchema>;

export const purchaseContractTermsSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  externalNumber: z.string().trim().min(1).max(80),
  cropYear: z.string().trim().min(3).max(30),
  signedOn: localDate.nullable(),
  pickupLocation: z.string().trim().min(3).max(240).nullable(),
  deliveryCondition: z.string().trim().min(3).max(160).nullable(),
  freightPayer: z.enum(['BUYER', 'SELLER', 'THIRD_PARTY']).nullable(),
  weighingResponsibility: z.string().trim().min(3).max(240).nullable(),
  qualityTerms: z.string().trim().min(3).max(2000).nullable(),
  requiredDocuments: z.string().trim().min(3).max(2000).nullable(),
  paymentTerms: z.string().trim().min(3).max(2000).nullable(),
});

export type PurchaseContractTermsInput = z.infer<typeof purchaseContractTermsSchema>;
