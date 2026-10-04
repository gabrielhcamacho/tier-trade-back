import { z } from 'zod';

const positiveQuantity = z.string()
  .regex(/^\d+(?:\.\d{1,3})?$/, 'Expected a positive quantity decimal string.')
  .refine((value) => Number(value) > 0, 'Value must be greater than zero.');

export const configureRiskPolicySchema = z.object({
  commodity: z.enum(['MILHO', 'SOJA']),
  maxNetOpenKg: positiveQuantity,
  warningThresholdPct: z.string()
    .regex(/^\d+(?:\.\d{1,2})?$/, 'Expected a percentage decimal string.')
    .refine((value) => Number(value) > 0 && Number(value) <= 100,
      'Percentage must be greater than zero and at most 100.'),
});

export type ConfigureRiskPolicyInput = z.infer<typeof configureRiskPolicySchema>;
