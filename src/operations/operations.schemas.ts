import { z } from 'zod';

const positiveDecimal = z.string()
  .regex(/^\d+(?:\.\d{1,3})?$/, 'Expected a positive decimal string with up to three decimal places.');

export const scheduleLoadSchema = z.object({
  scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Expected a local date and time.'),
  expectedWeightKg: positiveDecimal,
  vehiclePlate: z.string().trim()
    .transform((value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Invalid Brazilian vehicle plate.')),
  carrierName: z.string().trim().min(2).max(200),
  destinationCode: z.string().trim().toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/, 'Invalid destination code.')),
});

export type ScheduleLoadInput = z.infer<typeof scheduleLoadSchema>;
