import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

const invitedUserSchema = z.object({ id: z.uuid() });

export abstract class IdentityProvisioningPort {
  abstract invite(email: string, redirectTo: string): Promise<{ userId: string }>;
}

@Injectable()
export class SupabaseAdminClient extends IdentityProvisioningPort {
  async invite(email: string, redirectTo: string): Promise<{ userId: string }> {
    const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!projectUrl || !secretKey) {
      throw new ServiceUnavailableException({ code: 'AUTH_ADMIN_NOT_CONFIGURED' });
    }
    let response: Response;
    try {
      response = await fetch(`${projectUrl}/auth/v1/invite`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email, redirect_to: redirectTo }),
      });
    } catch {
      throw new ServiceUnavailableException({ code: 'AUTH_ADMIN_UNAVAILABLE' });
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 422) throw new ConflictException({ code: 'AUTH_USER_CANNOT_BE_INVITED' });
      throw new ServiceUnavailableException({ code: 'AUTH_INVITATION_FAILED' });
    }
    const user = invitedUserSchema.safeParse(payload);
    if (!user.success) throw new ServiceUnavailableException({ code: 'AUTH_INVITATION_INVALID_RESPONSE' });
    return { userId: user.data.id };
  }
}
