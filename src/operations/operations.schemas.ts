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

export const rescheduleLoadSchema = scheduleLoadSchema.extend({
  reason: z.string().trim().min(10).max(500),
});
export type RescheduleLoadInput = z.infer<typeof rescheduleLoadSchema>;

export const cancelLoadSchema = z.object({ reason: z.string().trim().min(10).max(500) });
export type CancelLoadInput = z.infer<typeof cancelLoadSchema>;

const percentageDecimal = z.string()
  .regex(/^\d+(?:\.\d{1,4})?$/, 'Expected a percentage with up to four decimal places.')
  .refine((value) => Number(value) <= 100, 'Percentage cannot exceed 100.');

export const recordLoadReceiptSchema = z.object({
  receivedAt: z.iso.datetime({ offset: true }),
  grossWeightKg: positiveDecimal,
  tareWeightKg: positiveDecimal,
  weighingMode: z.enum(['SCALE', 'MANUAL_CONTINGENCY']),
  scaleTicketNumber: z.string().trim().min(1).max(80).nullable(),
  contingencyReason: z.string().trim().min(10).max(500).nullable(),
  moisturePct: percentageDecimal,
  impurityPct: percentageDecimal,
  damagedPct: percentageDecimal,
  qualityDecision: z.enum(['ACCEPTED', 'REVIEW_REQUIRED']),
  notes: z.string().trim().min(1).max(1000).nullable(),
}).superRefine((value, context) => {
  if (value.weighingMode === 'SCALE' && !value.scaleTicketNumber) {
    context.addIssue({ code: 'custom', path: ['scaleTicketNumber'], message: 'Scale ticket is required.' });
  }
  if (value.weighingMode === 'MANUAL_CONTINGENCY' && !value.contingencyReason) {
    context.addIssue({ code: 'custom', path: ['contingencyReason'], message: 'Contingency reason is required.' });
  }
});

export type RecordLoadReceiptInput = z.infer<typeof recordLoadReceiptSchema>;
