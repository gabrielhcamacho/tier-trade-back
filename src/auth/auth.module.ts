import { Module } from '@nestjs/common';
import { IdentityVerifierPort, SupabaseJwtVerifier } from './supabase-jwt.verifier.js';
import { RequestIdentityGuard } from './request-identity.guard.js';

@Module({
  providers: [
    SupabaseJwtVerifier,
    { provide: IdentityVerifierPort, useExisting: SupabaseJwtVerifier },
    RequestIdentityGuard,
  ],
  exports: [IdentityVerifierPort, RequestIdentityGuard],
})
export class AuthModule {}
