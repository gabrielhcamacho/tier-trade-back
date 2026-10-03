import { z } from 'zod';

const positiveMoney = z.string()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Expected a positive monetary decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');

const accessKey = z.string().trim().regex(/^\d{44}$/, 'A chave de acesso deve conter exatamente 44 dígitos.').nullable();
const optionalText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum).nullable();
const uf = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Informe uma UF com duas letras.');
const nullableUf = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Informe uma UF com duas letras.').nullable();
const percentage = z.string().regex(/^\d+(?:\.\d{1,6})?$/, 'Informe um percentual decimal válido.')
  .refine((value) => Number(value) >= 0 && Number(value) <= 100, 'O percentual deve estar entre 0 e 100.');

export const taxComponentSchema = z.object({
  tax: z.enum(['ICMS', 'PIS', 'COFINS', 'FUNRURAL']),
  treatment: z.enum(['TAXED', 'EXEMPT', 'NON_TAXED', 'DEFERRED', 'SUSPENDED']),
  ratePct: percentage.nullable(),
  retained: z.boolean(),
}).superRefine((component, context) => {
  if (component.treatment === 'TAXED' && component.ratePct === null) {
    context.addIssue({ code: 'custom', path: ['ratePct'], message: 'Tratamento tributado exige alíquota.' });
  }
  if (component.treatment !== 'TAXED' && component.ratePct !== null) {
    context.addIssue({ code: 'custom', path: ['ratePct'], message: 'Somente tratamento tributado aceita alíquota.' });
  }
});

const taxComponents = z.array(taxComponentSchema).max(4).superRefine((components, context) => {
  const taxes = components.map((component) => component.tax);
  if (new Set(taxes).size !== taxes.length) {
    context.addIssue({ code: 'custom', message: 'Cada tributo pode aparecer apenas uma vez.' });
  }
});

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

export const createFiscalEstablishmentSchema = z.object({
  legalName: z.string().trim().min(3).max(180),
  taxId: z.string().trim().regex(/^\d{14}$/, 'O CNPJ deve conter 14 dígitos.'),
  stateRegistration: optionalText(2, 30),
  uf,
  taxRegime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']).nullable(),
});

export const createFiscalConfigurationSchema = z.object({
  establishmentId: z.uuid().nullable(),
  name: z.string().trim().min(3).max(120),
  commodity: optionalText(2, 40),
  destinationUf: nullableUf,
  cfop: z.string().trim().regex(/^\d{4}$/, 'O CFOP deve conter quatro dígitos.').nullable(),
  emissionStrategy: z.enum(['NATIVE', 'INTEGRATED']).nullable(),
  technicalResponsible: optionalText(3, 160),
  effectiveFrom: z.iso.date().nullable(),
  effectiveTo: z.iso.date().nullable(),
  taxComponents,
}).superRefine((configuration, context) => {
  if (configuration.effectiveFrom && configuration.effectiveTo
    && configuration.effectiveTo < configuration.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'O fim da vigência deve ser posterior ao início.' });
  }
});

export const updateFiscalConfigurationSchema = createFiscalConfigurationSchema;

export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>;
export type UpdateFiscalDocumentInput = z.infer<typeof updateFiscalDocumentSchema>;
export type RejectFiscalDocumentInput = z.infer<typeof rejectFiscalDocumentSchema>;
export type TaxComponentInput = z.infer<typeof taxComponentSchema>;
export type CreateFiscalEstablishmentInput = z.infer<typeof createFiscalEstablishmentSchema>;
export type CreateFiscalConfigurationInput = z.infer<typeof createFiscalConfigurationSchema>;
export type UpdateFiscalConfigurationInput = z.infer<typeof updateFiscalConfigurationSchema>;
