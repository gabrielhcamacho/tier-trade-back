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

export type CreateTitleInput = z.infer<typeof createTitleSchema>;
export type SettleTitleInput = z.infer<typeof settleTitleSchema>;
export type PayTitleInput = z.infer<typeof payTitleSchema>;
export type ReverseSettlementInput = z.infer<typeof reverseSettlementSchema>;
