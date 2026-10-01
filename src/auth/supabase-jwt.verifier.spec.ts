import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { verifySupabaseJwt } from './supabase-jwt.verifier.js';

describe('Supabase JWT verification', () => {
  it('accepts only a correctly issued authenticated user token', async () => {
    const keys = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(keys.publicKey);
    const issuer = 'https://tier-trade-test.supabase.co/auth/v1';
    const jwks = createLocalJWKSet({
      keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
    });
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('22222222-2222-4222-8222-222222222222')
      .setIssuer(issuer).setAudience('authenticated').setExpirationTime('5m').sign(keys.privateKey);
    await expect(verifySupabaseJwt(token, issuer, jwks)).resolves.toEqual({
      actorId: '22222222-2222-4222-8222-222222222222',
    });

    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('22222222-2222-4222-8222-222222222222')
      .setIssuer(issuer).setAudience('anon').setExpirationTime('5m').sign(keys.privateKey);
    await expect(verifySupabaseJwt(wrongAudience, issuer, jwks)).rejects.toThrow();
  });
});
