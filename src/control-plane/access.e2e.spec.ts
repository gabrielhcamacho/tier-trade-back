import { ForbiddenException, ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { TenantMembershipResolver } from '../auth/tenant-resolver.js';
import type { IdentityVerifierPort } from '../auth/supabase-jwt.verifier.js';
import { TenantDatabase } from '../database/database.js';
import { AccessService } from './access.service.js';
import type { IdentityProvisioningPort } from './supabase-admin.client.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const tenantId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const invitedId = '55555555-5555-4555-8555-555555555555';

class FakeIdentityProvisioning implements IdentityProvisioningPort {
  calls: Array<{ email: string; redirectTo: string }> = [];
  userId = invitedId;
  failure = false;

  async invite(email: string, redirectTo: string) {
    this.calls.push({ email, redirectTo });
    if (this.failure) throw new ServiceUnavailableException({ code: 'AUTH_ADMIN_UNAVAILABLE' });
    return { userId: this.userId };
  }
}

describe.runIf(Boolean(databaseUrl))('control plane access with PostgreSQL', () => {
  let pool: Pool;
  let db: TenantDatabase;
  let provisioning: FakeIdentityProvisioning;
  let service: AccessService;
  let resolver: TenantMembershipResolver;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('DROP SCHEMA IF EXISTS control CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS app CASCADE');
    for (const migrationName of [
      '20261001000100_commercial_foundation.sql',
      '20261001000200_outbox_read_models.sql',
      '20261001000300_commercial_governance.sql',
      '20261001193311_harden_tenant_rls.sql',
      '20261001194949_optimize_tenant_rls.sql',
      '20261001224302_control_plane_access.sql',
      '20261001224527_index_control_invitation_inviter.sql',
    ]) {
      await pool.query(await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8'));
    }
    await pool.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    db = new TenantDatabase(pool);
    provisioning = new FakeIdentityProvisioning();
    service = new AccessService(db, provisioning);
    resolver = new TenantMembershipResolver(db);
  }, 30_000);

  afterAll(async () => {
    await db?.onModuleDestroy();
  });

  it('invites, resolves and accepts access without a public tenant id', async () => {
    const invitation = await service.invite(tenantId, adminId, {
      email: 'operador@exemplo.com', capabilities: ['COMMERCIAL_EDIT'],
    });
    expect(invitation).toMatchObject({ email: 'operador@exemplo.com', status: 'SENT' });
    expect(provisioning.calls).toEqual([{
      email: 'operador@exemplo.com', redirectTo: 'http://localhost:3000/update-password',
    }]);
    expect(await resolver.resolve(invitedId)).toBe(tenantId);

    const session = await service.session(tenantId, invitedId);
    expect(session).toMatchObject({
      actorId: invitedId,
      tenant: { id: tenantId, legalName: 'Tenant local' },
      capabilities: ['COMMERCIAL_EDIT'],
    });
    const accepted = await pool.query<{ status: string; event_type: string }>(
      `SELECT invitation.status,event.event_type
         FROM control.access_invitations invitation
         JOIN app.audit_events event ON event.tenant_id=invitation.tenant_id
           AND event.aggregate_id=invitation.id
        WHERE invitation.id=$1`,
      [invitation.invitationId],
    );
    expect(accepted.rows).toEqual([{ status: 'ACCEPTED', event_type: 'access.invited' }]);

    await expect(service.invite(tenantId, adminId, {
      email: 'operador@exemplo.com', capabilities: ['COMMERCIAL_EDIT'],
    })).rejects.toMatchObject({ response: { code: 'EMAIL_ALREADY_MEMBER' } });
  });

  it('enforces access management and records provisioning failures', async () => {
    await expect(service.invite(tenantId, invitedId, {
      email: 'sem-permissao@exemplo.com', capabilities: ['COMMERCIAL_EDIT'],
    })).rejects.toMatchObject({ response: { code: 'CAPABILITY_NOT_FOUND' } });

    provisioning.failure = true;
    await expect(service.invite(tenantId, adminId, {
      email: 'falha@exemplo.com', capabilities: ['COMMERCIAL_EDIT'],
    })).rejects.toMatchObject({ response: { code: 'AUTH_ADMIN_UNAVAILABLE' } });
    provisioning.failure = false;
    const failed = await pool.query<{ status: string; failure_code: string }>(
      `SELECT status,failure_code FROM control.access_invitations
        WHERE tenant_id=$1 AND email='falha@exemplo.com'`,
      [tenantId],
    );
    expect(failed.rows).toEqual([{ status: 'FAILED', failure_code: 'AUTH_ADMIN_UNAVAILABLE' }]);
  });

  it('resolves the authenticated actor and rejects users without membership', async () => {
    const verifier: IdentityVerifierPort = {
      verify: async (token: string) => ({ actorId: token === 'invited' ? invitedId : crypto.randomUUID() }),
    };
    const guard = new RequestIdentityGuard(verifier, resolver);
    process.env.AUTH_MODE = 'supabase';
    const request: { headers: Record<string, string>; identity?: { tenantId: string; actorId: string } } = {
      headers: { authorization: 'Bearer invited' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.identity).toEqual({ tenantId, actorId: invitedId });

    const missingRequest = { headers: { authorization: 'Bearer unknown' } };
    const missingContext = {
      switchToHttp: () => ({ getRequest: () => missingRequest }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(missingContext)).rejects.toBeInstanceOf(ForbiddenException);
    process.env.AUTH_MODE = 'development';
  });
});
