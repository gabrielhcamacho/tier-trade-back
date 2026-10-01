import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { IdentityVerifierPort } from './supabase-jwt.verifier.js';
import { TenantResolverPort } from './tenant-resolver.js';

export interface RequestIdentity {
  tenantId: string;
  actorId: string;
}

interface IdentityRequest {
  headers: Record<string, string | string[] | undefined>;
  identity?: RequestIdentity;
}

const tenantSchema = z.uuid();
const developmentIdentitySchema = z.object({ tenantId: z.uuid(), actorId: z.uuid() });

export const Identity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestIdentity => {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    if (!request.identity) throw new UnauthorizedException({ code: 'IDENTITY_NOT_RESOLVED' });
    return request.identity;
  },
);

@Injectable()
export class RequestIdentityGuard implements CanActivate {
  constructor(
    @Inject(IdentityVerifierPort) private readonly verifier: IdentityVerifierPort,
    @Inject(TenantResolverPort) private readonly tenantResolver: TenantResolverPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const mode = process.env.AUTH_MODE ?? (process.env.NODE_ENV === 'production' ? 'supabase' : 'development');
    if (mode === 'development') {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException({ code: 'DEVELOPMENT_AUTH_DISABLED' });
      }
      const identity = developmentIdentitySchema.safeParse({
        tenantId: request.headers['x-tenant-id'],
        actorId: request.headers['x-actor-id'],
      });
      if (!identity.success) throw new UnauthorizedException({ code: 'DEVELOPMENT_IDENTITY_REQUIRED' });
      request.identity = identity.data;
      return true;
    }
    if (mode !== 'supabase') throw new ForbiddenException({ code: 'UNKNOWN_AUTH_MODE' });

    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' ? /^Bearer (\S+)$/.exec(authorization) : null;
    if (!match?.[1]) throw new UnauthorizedException({ code: 'BEARER_TOKEN_REQUIRED' });
    const verified = await this.verifier.verify(match[1]);
    const tenantId = await this.tenantResolver.resolve(verified.actorId);
    request.identity = { tenantId, actorId: verified.actorId };
    return true;
  }
}
