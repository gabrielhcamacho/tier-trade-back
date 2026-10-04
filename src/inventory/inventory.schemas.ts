import { z } from 'zod';

const positiveDecimal = z.string()
  .regex(/^\d+(?:\.\d{1,6})?$/, 'Expected a positive decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');
const date = z.iso.date();

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

export type SalesContractInput = z.infer<typeof salesContractSchema>;
export type AllocationInput = z.infer<typeof allocationSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
