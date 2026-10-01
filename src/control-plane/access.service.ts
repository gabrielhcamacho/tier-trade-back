import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type { CreateInvitationInput } from './access.schemas.js';
import { IdentityProvisioningPort } from './supabase-admin.client.js';

interface SessionRow {
  tenant_id: string;
  legal_name: string;
  timezone: string;
  capabilities: string[];
}

@Injectable()
export class AccessService {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(IdentityProvisioningPort) private readonly identityProvisioning: IdentityProvisioningPort,
  ) {}

  session(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      const session = await this.db.one<SessionRow>(client,
        `SELECT m.tenant_id,t.legal_name,t.timezone,m.capabilities
           FROM app.memberships m JOIN app.tenants t ON t.id=m.tenant_id
          WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.active=true`,
        [tenantId, actorId]);
      await client.query(
        `UPDATE control.access_invitations SET status='ACCEPTED',accepted_at=now()
          WHERE tenant_id=$1 AND invited_user_id=$2 AND status='SENT'`,
        [tenantId, actorId],
      );
      return {
        actorId,
        tenant: { id: session.tenant_id, legalName: session.legal_name, timezone: session.timezone },
        capabilities: session.capabilities,
      };
    });
  }

  async invite(tenantId: string, actorId: string, input: CreateInvitationInput) {
    const invitationId = randomUUID();
    const lifetimeSeconds = this.invitationLifetimeSeconds();
    const expiresAt = new Date(Date.now() + lifetimeSeconds * 1000);
    await this.db.transaction(tenantId, async (client) => {
      await this.assertAccessManager(client, tenantId, actorId);
      await client.query(
        `UPDATE control.access_invitations SET status='EXPIRED'
          WHERE tenant_id=$1 AND status IN ('PENDING','SENT') AND expires_at <= now()`,
        [tenantId],
      );
      const previous = await client.query<{ status: string }>(
        `SELECT status FROM control.access_invitations
          WHERE tenant_id=$1 AND email=$2 ORDER BY created_at DESC LIMIT 1`,
        [tenantId, input.email],
      );
      if (previous.rows[0]?.status === 'ACCEPTED') {
        throw new ConflictException({ code: 'EMAIL_ALREADY_MEMBER' });
      }
      try {
        await client.query(
          `INSERT INTO control.access_invitations
            (tenant_id,id,email,capabilities,status,invited_by,expires_at)
           VALUES ($1,$2,$3,$4,'PENDING',$5,$6)`,
          [tenantId, invitationId, input.email, input.capabilities, actorId, expiresAt],
        );
      } catch (cause) {
        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
          throw new ConflictException({ code: 'INVITATION_ALREADY_OPEN' });
        }
        throw cause;
      }
    });

    let invited: { userId: string };
    try {
      const webUrl = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      invited = await this.identityProvisioning.invite(input.email, `${webUrl}/update-password`);
    } catch (cause) {
      await this.failInvitation(tenantId, invitationId, this.failureCode(cause));
      throw cause;
    }

    await this.db.transaction(tenantId, async (client) => {
      await client.query(
        `INSERT INTO app.memberships (tenant_id,user_id,active,capabilities)
         VALUES ($1,$2,true,$3)
         ON CONFLICT (tenant_id,user_id) DO UPDATE
           SET active=true,capabilities=excluded.capabilities`,
        [tenantId, invited.userId, input.capabilities],
      );
      await client.query(
        `UPDATE control.access_invitations
            SET invited_user_id=$3,status='SENT',failure_code=NULL
          WHERE tenant_id=$1 AND id=$2 AND status='PENDING'`,
        [tenantId, invitationId, invited.userId],
      );
      await this.record(client, tenantId, actorId, invitationId, {
        email: input.email,
        invitedUserId: invited.userId,
        capabilities: input.capabilities,
      });
    });
    return { invitationId, email: input.email, status: 'SENT', capabilities: input.capabilities, expiresAt };
  }

  private invitationLifetimeSeconds() {
    const configured = Number.parseInt(process.env.AUTH_INVITATION_TTL_SECONDS ?? '3600', 10);
    return Number.isSafeInteger(configured) && configured >= 300 ? configured : 3600;
  }

  private async assertAccessManager(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true
        AND 'ACCESS_MANAGE'=ANY(capabilities)`,
      [tenantId, actorId],
    );
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
  }

  private failInvitation(tenantId: string, invitationId: string, failureCode: string) {
    return this.db.transaction(tenantId, async (client) => {
      await client.query(
        `UPDATE control.access_invitations SET status='FAILED',failure_code=$3
          WHERE tenant_id=$1 AND id=$2 AND status='PENDING'`,
        [tenantId, invitationId, failureCode],
      );
    });
  }

  private failureCode(cause: unknown) {
    if (typeof cause === 'object' && cause !== null && 'getResponse' in cause
      && typeof cause.getResponse === 'function') {
      const response = cause.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response
        && typeof response.code === 'string') return response.code;
    }
    return 'AUTH_INVITATION_FAILED';
  }

  private async record(client: PoolClient, tenantId: string, actorId: string, invitationId: string,
    payload: object) {
    const eventId = randomUUID();
    await client.query(
      `INSERT INTO app.audit_events (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,'access.invited','access_invitation',$4,$5::jsonb)`,
      [tenantId, eventId, actorId, invitationId, JSON.stringify(payload)],
    );
    await client.query(
      `INSERT INTO app.outbox_events (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,'access.invited','access_invitation',$3,$4::jsonb)`,
      [tenantId, eventId, invitationId, JSON.stringify(payload)],
    );
  }
}
