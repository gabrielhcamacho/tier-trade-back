import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

const claimsSchema = z.object({ sub: z.uuid() });

export async function verifySupabaseJwt(accessToken: string, issuer: string, jwks: JWTVerifyGetKey) {
  const { payload } = await jwtVerify(accessToken, jwks, { issuer, audience: 'authenticated' });
  const claims = claimsSchema.parse(payload);
  return { actorId: claims.sub };
}

export abstract class IdentityVerifierPort {
  abstract verify(accessToken: string): Promise<{ actorId: string }>;
}

@Injectable()
export class SupabaseJwtVerifier extends IdentityVerifierPort {
  private readonly issuer?: string;
  private readonly jwks?: JWTVerifyGetKey;

  constructor() {
    super();
    const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (projectUrl) {
      this.issuer = `${projectUrl}/auth/v1`;
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
    }
  }

  async verify(accessToken: string): Promise<{ actorId: string }> {
    if (!this.issuer || !this.jwks) {
      throw new UnauthorizedException({ code: 'AUTH_NOT_CONFIGURED' });
    }
    try {
      return await verifySupabaseJwt(accessToken, this.issuer, this.jwks);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }
  }
}
