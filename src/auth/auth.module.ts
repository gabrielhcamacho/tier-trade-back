import { Module } from '@nestjs/common';
import { IdentityVerifierPort, SupabaseJwtVerifier } from './supabase-jwt.verifier.js';
import { RequestIdentityGuard } from './request-identity.guard.js';
import { DatabaseModule } from '../database/database.js';
import { TenantMembershipResolver, TenantResolverPort } from './tenant-resolver.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    SupabaseJwtVerifier,
    { provide: IdentityVerifierPort, useExisting: SupabaseJwtVerifier },
    RequestIdentityGuard,
    TenantMembershipResolver,
    { provide: TenantResolverPort, useExisting: TenantMembershipResolver },
  ],
  exports: [IdentityVerifierPort, RequestIdentityGuard, TenantResolverPort],
})
export class AuthModule {}
