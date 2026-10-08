import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabasePlatformPort } from '../database/database.js';
import { DASHBOARD_MODULES, isDashboardModule, type DashboardModuleName } from './dashboard.constants.js';

const STALE_AFTER_SECONDS = 15;

interface SnapshotRow {
  module: DashboardModuleName;
  scope_key: string;
  contract_version: number;
  snapshot_version: string;
  source_event_id: string | null;
  source_event_occurred_at: Date | null;
  generated_at: Date;
  build_duration_ms: number;
  payload: Record<string, unknown>;
  refreshing: boolean;
}

@Injectable()
export class DashboardQueryService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async one(tenantId: string, actorId: string, moduleValue: string) {
    if (!isDashboardModule(moduleValue)) {
      throw new BadRequestException({ code: 'DASHBOARD_MODULE_UNSUPPORTED', supported: DASHBOARD_MODULES });
    }
    const snapshots = await this.read(tenantId, actorId, [moduleValue]);
    return this.present(tenantId, moduleValue, snapshots.get(moduleValue));
  }

  async all(tenantId: string, actorId: string) {
    const snapshots = await this.read(tenantId, actorId, [...DASHBOARD_MODULES]);
    const modules = DASHBOARD_MODULES.map((module) => this.present(tenantId, module, snapshots.get(module)).body);
    const versionSeed = modules.map((module) =>
      `${module.module}:${module.snapshotVersion ?? 0}:${module.freshness}`).join('|');
    return {
      etag: this.etag(tenantId, 'all', versionSeed),
      body: { contractVersion: 1, generatedAt: new Date().toISOString(), modules },
    };
  }

  async requestRefresh(tenantId: string, actorId: string, moduleValue: string) {
    if (!isDashboardModule(moduleValue)) {
      throw new BadRequestException({ code: 'DASHBOARD_MODULE_UNSUPPORTED', supported: DASHBOARD_MODULES });
    }
    await this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      await client.query(
        `INSERT INTO app.dashboard_refresh_queue (tenant_id,module,scope_key,requested_version,requested_at,available_at)
         SELECT $1,$2,'default',COALESCE(snapshot_version+1,1),now(),now()
           FROM (SELECT 1) seed
           LEFT JOIN app.dashboard_snapshots snapshot
             ON snapshot.tenant_id=$1 AND snapshot.module=$2 AND snapshot.scope_key='default'
         ON CONFLICT (tenant_id,module,scope_key) DO UPDATE SET
           requested_version=GREATEST(
             app.dashboard_refresh_queue.requested_version+1,excluded.requested_version
           ),
           requested_at=now(),available_at=LEAST(app.dashboard_refresh_queue.available_at,now()),last_error=NULL`,
        [tenantId, moduleValue],
      );
    });
    return { accepted: true, module: moduleValue, freshness: 'REBUILDING' };
  }

  private read(tenantId: string, actorId: string, modules: DashboardModuleName[]) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<SnapshotRow>(
        `SELECT snapshot.module,snapshot.scope_key,snapshot.contract_version,
                snapshot.snapshot_version::text,snapshot.source_event_id,
                snapshot.source_event_occurred_at,snapshot.generated_at,snapshot.build_duration_ms,
                snapshot.payload,(refresh.module IS NOT NULL) AS refreshing
           FROM app.dashboard_snapshots snapshot
           LEFT JOIN app.dashboard_refresh_queue refresh
             ON (refresh.tenant_id,refresh.module,refresh.scope_key)=
                (snapshot.tenant_id,snapshot.module,snapshot.scope_key)
          WHERE snapshot.tenant_id=$1 AND snapshot.scope_key='default' AND snapshot.module=ANY($2::text[])`,
        [tenantId, modules],
      );
      const byModule = new Map(result.rows.map((row) => [row.module, row]));
      const missingOrStale = modules.filter((module) => {
        const row = byModule.get(module);
        return !row || (!row.refreshing && Date.now() - row.generated_at.getTime() > STALE_AFTER_SECONDS * 1000);
      });
      if (missingOrStale.length) {
        await client.query(
          `INSERT INTO app.dashboard_refresh_queue (tenant_id,module,scope_key,requested_version,requested_at,available_at)
           SELECT $1,requested.module,'default',COALESCE(snapshot.snapshot_version+1,1),now(),now()
             FROM unnest($2::text[]) AS requested(module)
             LEFT JOIN app.dashboard_snapshots snapshot
               ON snapshot.tenant_id=$1 AND snapshot.module=requested.module AND snapshot.scope_key='default'
           ON CONFLICT (tenant_id,module,scope_key) DO NOTHING`,
          [tenantId, missingOrStale],
        );
      }
      return byModule;
    });
  }

  private async assertMember(client: import('pg').PoolClient, tenantId: string, actorId: string): Promise<void> {
    const membership = await client.query(
      'SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true', [tenantId, actorId]);
    if (membership.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_REQUIRED' });
  }

  private present(tenantId: string, module: DashboardModuleName, row: SnapshotRow | undefined) {
    if (!row) {
      return { etag: this.etag(tenantId, module, '0'), body: {
        contractVersion: 1, module, scopeKey: 'default', snapshotVersion: null,
        generatedAt: null, sourceWatermark: null, freshness: 'REBUILDING', payload: null,
      } };
    }
    const ageSeconds = Math.max(0, Math.floor((Date.now() - row.generated_at.getTime()) / 1000));
    const freshness = row.refreshing ? 'REBUILDING' : ageSeconds > STALE_AFTER_SECONDS ? 'STALE' : 'FRESH';
    return { etag: this.etag(tenantId, module, `${row.snapshot_version}:${freshness}`), body: {
      contractVersion: row.contract_version,
      module: row.module,
      scopeKey: row.scope_key,
      snapshotVersion: row.snapshot_version,
      generatedAt: row.generated_at.toISOString(),
      sourceWatermark: row.source_event_id ? {
        eventId: row.source_event_id,
        occurredAt: row.source_event_occurred_at?.toISOString() ?? null,
      } : null,
      freshness,
      buildDurationMs: row.build_duration_ms,
      payload: row.payload,
    } };
  }

  private etag(tenantId: string, module: string, version: string): string {
    return `\"${createHash('sha256').update(`${tenantId}:${module}:default:${version}`).digest('base64url')}\"`;
  }
}
