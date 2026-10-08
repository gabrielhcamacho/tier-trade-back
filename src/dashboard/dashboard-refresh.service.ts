import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { DASHBOARD_MODULES, dashboardModulesForEvent, type DashboardModuleName } from './dashboard.constants.js';

@Injectable()
export class DashboardRefreshService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async listActiveTenants(afterTenantId: string | null, limit: number): Promise<string[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.db.controlPlaneTransaction(async (client) => {
      const result = await client.query<{ tenant_id: string }>(
        `SELECT DISTINCT tenant_id
           FROM control.membership_directory
          WHERE active=true AND ($1::uuid IS NULL OR tenant_id>$1::uuid)
          ORDER BY tenant_id
          LIMIT $2`,
        [afterTenantId, safeLimit],
      );
      return result.rows.map((row) => row.tenant_id);
    });
  }

  async ensureMissingSnapshots(tenantId: string): Promise<number> {
    return this.db.transaction(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO app.dashboard_refresh_queue (tenant_id,module,scope_key,requested_version,requested_at,available_at)
         SELECT $1,requested.module,'default',1,now(),now()
           FROM unnest($2::text[]) AS requested(module)
          WHERE NOT EXISTS (
            SELECT 1 FROM app.dashboard_snapshots snapshot
             WHERE snapshot.tenant_id=$1 AND snapshot.module=requested.module AND snapshot.scope_key='default'
          )
         ON CONFLICT (tenant_id,module,scope_key) DO NOTHING
         RETURNING module`,
        [tenantId, DASHBOARD_MODULES],
      );
      return result.rows.length;
    });
  }

  async request(tenantId: string, module: DashboardModuleName): Promise<void> {
    await this.db.transaction(tenantId, async (client) => {
      await this.enqueue(client, tenantId, [module], null, null);
    });
  }

  enqueueForEvent(client: PoolClient, tenantId: string, event: {
    id: string;
    event_type: string;
    occurred_at: Date;
  }): Promise<void> {
    return this.enqueue(
      client,
      tenantId,
      dashboardModulesForEvent(event.event_type),
      event.id,
      event.occurred_at,
    );
  }

  private async enqueue(
    client: PoolClient,
    tenantId: string,
    modules: DashboardModuleName[],
    eventId: string | null,
    occurredAt: Date | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.dashboard_refresh_queue
         (tenant_id,module,scope_key,requested_version,reason_event_id,reason_event_occurred_at,requested_at,available_at)
       SELECT $1,requested.module,'default',COALESCE(snapshot.snapshot_version+1,1),$3,$4,now(),now()
         FROM unnest($2::text[]) AS requested(module)
         LEFT JOIN app.dashboard_snapshots snapshot
           ON snapshot.tenant_id=$1 AND snapshot.module=requested.module AND snapshot.scope_key='default'
       ON CONFLICT (tenant_id,module,scope_key) DO UPDATE SET
         requested_version=GREATEST(
           app.dashboard_refresh_queue.requested_version+1,excluded.requested_version
         ),
         reason_event_id=excluded.reason_event_id,
         reason_event_occurred_at=excluded.reason_event_occurred_at,
         requested_at=now(),
         available_at=LEAST(app.dashboard_refresh_queue.available_at,now()),
         last_error=NULL`,
      [tenantId, modules, eventId, occurredAt],
    );
  }
}
