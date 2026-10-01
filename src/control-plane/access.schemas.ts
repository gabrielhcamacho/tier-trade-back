import { z } from 'zod';
import { CAPABILITIES } from './capabilities.js';

export const createInvitationSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  capabilities: z.array(z.enum(CAPABILITIES)).min(1).max(CAPABILITIES.length)
    .transform((values) => [...new Set(values)]),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
