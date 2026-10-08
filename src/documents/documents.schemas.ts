import { z } from 'zod';

export const createUploadRequestSchema = z.object({
  aggregateType: z.enum([
    'CONTRACT', 'SALES_CONTRACT', 'LOAD', 'FISCAL_DOCUMENT', 'COUNTERPARTY', 'INVENTORY_LOT',
  ]),
  aggregateId: z.uuid(),
  documentType: z.enum([
    'CONTRACT_DRAFT', 'SIGNED_CONTRACT', 'AMENDMENT', 'GUARANTEE', 'INVOICE', 'ROMANEIO',
    'QUALITY_REPORT', 'WEIGHING_TICKET', 'OTHER',
  ]),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum([
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  sizeBytes: z.number().int().min(1).max(26_214_400),
  notes: z.string().trim().min(1).max(1000).nullable().default(null),
});

export const signatureSchema = z.object({
  provider: z.enum(['MANUAL', 'DOCUSIGN', 'OTHER']),
  externalEnvelopeId: z.string().trim().min(1).max(240).nullable().default(null),
  signerName: z.string().trim().min(2).max(160),
  signerEmail: z.email().nullable().default(null),
  signerRole: z.string().trim().min(2).max(80),
  status: z.enum(['PENDING', 'SENT', 'SIGNED', 'DECLINED', 'CANCELLED']),
  sentAt: z.iso.datetime({ offset: true }).nullable().default(null),
  signedAt: z.iso.datetime({ offset: true }).nullable().default(null),
}).superRefine((value, context) => {
  if (value.status === 'SIGNED' && !value.signedAt) {
    context.addIssue({ code: 'custom', path: ['signedAt'], message: 'Signed date is required.' });
  }
});

export const documentArchiveQuerySchema = z.object({
  aggregateType: createUploadRequestSchema.shape.aggregateType.optional(),
  documentType: createUploadRequestSchema.shape.documentType.optional(),
  status: z.enum(['PENDING_UPLOAD', 'AVAILABLE', 'ARCHIVED']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  criterion: z.string().trim().max(120).optional(),
  page: z.coerce.number<number>().int().min(1).max(100_000).default(1),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ['to'], message: 'The end date must be on or after the start date.',
});

export type CreateUploadRequestInput = z.infer<typeof createUploadRequestSchema>;
export type SignatureInput = z.infer<typeof signatureSchema>;
export type DocumentArchiveQuery = z.infer<typeof documentArchiveQuerySchema>;
