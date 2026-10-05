import { z } from 'zod';

const positiveMoney = z.string()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Expected a positive monetary decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');

export const createTitleSchema = z.object({
  financialEventId: z.uuid(),
  titleNumber: z.string().trim().min(3).max(40),
  documentReference: z.string().trim().min(1).max(80),
  dueDate: z.iso.date(),
});

export const settleTitleSchema = z.object({
  amount: positiveMoney,
  receivedAt: z.iso.datetime({ offset: true }),
  bankReference: z.string().trim().min(1).max(80),
  notes: z.string().trim().min(1).max(1000).nullable(),
});

export const payTitleSchema = z.object({
  amount: positiveMoney,
  paidAt: z.iso.datetime({ offset: true }),
  bankReference: z.string().trim().min(1).max(80),
  notes: z.string().trim().min(1).max(1000).nullable(),
});

export const reverseSettlementSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const createPurchaseCostComponentSchema = z.object({
  financialEventId: z.uuid(),
  componentType: z.enum(['QUALITY_DISCOUNT', 'FREIGHT', 'STORAGE', 'TAX_WITHHOLDING', 'OTHER']),
  payableImpact: z.enum(['REDUCE_PAYABLE', 'INCREASE_PAYABLE', 'MEMO_ONLY']),
  amount: positiveMoney,
  description: z.string().trim().min(3).max(500),
  externalReference: z.string().trim().min(1).max(80).nullable(),
});

export const configureFinancePolicySchema = z.object({
  paymentApprovalThreshold: z.string()
    .regex(/^\d+(?:\.\d{1,2})?$/, 'Expected a non-negative monetary decimal string.'),
});

export const createPaymentBatchSchema = z.object({
  reference: z.string().trim().min(3).max(40),
  scheduledOn: z.iso.date(),
  items: z.array(z.object({ titleId: z.uuid(), amount: positiveMoney })).min(1).max(200),
});

export const createBankAccountSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/),
  name: z.string().trim().min(3).max(120),
});

export const createBankStatementEntrySchema = z.object({
  bankAccountId: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  direction: z.enum(['CREDIT', 'DEBIT']),
  amount: positiveMoney,
  bankReference: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500).nullable(),
});

export const reconcileBankStatementEntrySchema = z.object({
  matchedType: z.enum(['SETTLEMENT', 'PAYMENT']),
  matchedId: z.uuid(),
});

export const createCommissionPolicySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/),
  name: z.string().trim().min(3).max(120),
  status: z.enum(['DRAFT', 'ACTIVE']),
  basis: z.literal('FINANCIAL_EVENT_AMOUNT'),
  ratePct: z.string().regex(/^\d+(?:\.\d{1,6})?$/).refine((value) => Number(value) <= 100),
  commodity: z.enum(['MILHO', 'SOJA']).nullable(),
  beneficiaryName: z.string().trim().min(2).max(160),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
  path: ['effectiveTo'], message: 'Effective end must not precede start.',
});

export const accrueCommissionSchema = z.object({
  policyId: z.uuid(),
  financialEventId: z.uuid(),
});

export type CreateTitleInput = z.infer<typeof createTitleSchema>;
export type SettleTitleInput = z.infer<typeof settleTitleSchema>;
export type PayTitleInput = z.infer<typeof payTitleSchema>;
export type ReverseSettlementInput = z.infer<typeof reverseSettlementSchema>;
export type CreatePurchaseCostComponentInput = z.infer<typeof createPurchaseCostComponentSchema>;
export type ConfigureFinancePolicyInput = z.infer<typeof configureFinancePolicySchema>;
export type CreatePaymentBatchInput = z.infer<typeof createPaymentBatchSchema>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type CreateBankStatementEntryInput = z.infer<typeof createBankStatementEntrySchema>;
export type ReconcileBankStatementEntryInput = z.infer<typeof reconcileBankStatementEntrySchema>;
export type CreateCommissionPolicyInput = z.infer<typeof createCommissionPolicySchema>;
export type AccrueCommissionInput = z.infer<typeof accrueCommissionSchema>;
