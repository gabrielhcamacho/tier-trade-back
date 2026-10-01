import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

const identitySchema = z.object({
  tenantId: z.uuid(),
  actorId: z.uuid(),
});

@Injectable()
export class DevelopmentIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({
        code: 'AUTH_ADAPTER_REQUIRED',
        message: 'Development header identity is disabled in production.',
      });
    }
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const parsed = identitySchema.safeParse({
      tenantId: request.headers['x-tenant-id'],
      actorId: request.headers['x-actor-id'],
    });
    if (!parsed.success) throw new UnauthorizedException('Valid development identity headers are required.');
    return true;
  }
}
