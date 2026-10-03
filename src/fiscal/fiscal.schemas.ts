import { z } from 'zod';

const positiveMoney = z.string()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Expected a positive monetary decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');

const accessKey = z.string().trim().regex(/^\d{44}$/, 'A chave de acesso deve conter exatamente 44 dígitos.').nullable();

export const createFiscalDocumentSchema = z.object({
  financialEventId: z.uuid(),
  documentNumber: z.string().trim().min(1).max(40),
  accessKey,
  issuedAt: z.iso.datetime({ offset: true }),
  totalAmount: positiveMoney,
  validationNotes: z.string().trim().min(3).max(1000).nullable(),
});

export const updateFiscalDocumentSchema = z.object({
  documentNumber: z.string().trim().min(1).max(40),
  accessKey,
  issuedAt: z.iso.datetime({ offset: true }),
  totalAmount: positiveMoney,
  validationNotes: z.string().trim().min(3).max(1000).nullable(),
});

export const rejectFiscalDocumentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>;
export type UpdateFiscalDocumentInput = z.infer<typeof updateFiscalDocumentSchema>;
export type RejectFiscalDocumentInput = z.infer<typeof rejectFiscalDocumentSchema>;
