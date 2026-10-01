import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabasePlatformPort } from '../database/database.js';

export abstract class TenantResolverPort {
  abstract resolve(actorId: string): Promise<string>;
}

@Injectable()
export class TenantMembershipResolver extends TenantResolverPort {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {
    super();
  }

  async resolve(actorId: string): Promise<string> {
    const tenantId = await this.db.controlPlaneTransaction(async (client) => {
      const result = await client.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM control.membership_directory
          WHERE user_id=$1 AND active=true`,
        [actorId],
      );
      return result.rows[0]?.tenant_id;
    });
    if (!tenantId) throw new ForbiddenException({ code: 'ACTIVE_MEMBERSHIP_REQUIRED' });
    return tenantId;
  }
}
