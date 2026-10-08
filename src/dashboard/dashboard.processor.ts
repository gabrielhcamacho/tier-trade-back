import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabasePlatformPort } from '../database/database.js';
import type { DashboardModuleName } from './dashboard.constants.js';
import { DashboardSnapshotBuilder } from './dashboard-snapshot.builder.js';

interface ClaimedRefresh {
  module: DashboardModuleName;
  scope_key: string;
  requested_version: string;
  reason_event_id: string | null;
  reason_event_occurred_at: Date | null;
  attempts: number;
}

export interface DashboardBatchResult {
  claimed: number;
  built: number;
  failed: number;
  pending: number;
  durationMs: number;
}

@Injectable()
export class DashboardProcessor {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(DashboardSnapshotBuilder) private readonly builder: DashboardSnapshotBuilder,
  ) {}

  async processTenant(tenantId: string, workerId = randomUUID(), batchSize = 8): Promise<DashboardBatchResult> {
    const startedAt = performance.now();
    const refreshes = await this.claim(tenantId, workerId, batchSize);
    let built = 0;
    let failed = 0;
    for (const refresh of refreshes) {
      try {
        await this.build(tenantId, workerId, refresh);
        built += 1;
      } catch (error) {
        failed += 1;
        await this.releaseForRetry(tenantId, workerId, refresh, error);
      }
    }
    const pending = await this.pending(tenantId);
    return { claimed: refreshes.length, built, failed, pending,
      durationMs: Math.round(performance.now() - startedAt) };
  }

  private claim(tenantId: string, workerId: string, batchSize: number): Promise<ClaimedRefresh[]> {
    const safeBatchSize = Math.min(Math.max(Math.trunc(batchSize), 1), 25);
    return this.db.transaction(tenantId, async (client) => {
      const result = await client.query<ClaimedRefresh>(
        `WITH candidates AS (
           SELECT tenant_id,module,scope_key
             FROM app.dashboard_refresh_queue
            WHERE tenant_id=$1 AND available_at<=now()
              AND (locked_at IS NULL OR locked_at<now()-interval '2 minutes')
            ORDER BY requested_at,module,scope_key
            FOR UPDATE SKIP LOCKED
            LIMIT $2
         )
         UPDATE app.dashboard_refresh_queue refresh
            SET locked_at=now(),lock_owner=$3,attempts=refresh.attempts+1
           FROM candidates
          WHERE (refresh.tenant_id,refresh.module,refresh.scope_key)=
                (candidates.tenant_id,candidates.module,candidates.scope_key)
         RETURNING refresh.module,refresh.scope_key,refresh.requested_version::text,
                   refresh.reason_event_id,refresh.reason_event_occurred_at,refresh.attempts`,
        [tenantId, safeBatchSize, workerId],
      );
      return result.rows;
    });
  }

  private build(tenantId: string, workerId: string, refresh: ClaimedRefresh): Promise<void> {
    return this.db.transaction(tenantId, async (client) => {
      const startedAt = performance.now();
      const payload = await this.builder.build(client, tenantId, refresh.module);
      const durationMs = Math.round(performance.now() - startedAt);
      await client.query(
        `INSERT INTO app.dashboard_snapshots
          (tenant_id,module,scope_key,contract_version,snapshot_version,source_event_id,
           source_event_occurred_at,generated_at,build_duration_ms,payload)
         VALUES ($1,$2,$3,1,$4,$5,$6,now(),$7,$8::jsonb)
         ON CONFLICT (tenant_id,module,scope_key) DO UPDATE SET
           contract_version=excluded.contract_version,
           snapshot_version=GREATEST(app.dashboard_snapshots.snapshot_version,excluded.snapshot_version),
           source_event_id=excluded.source_event_id,
           source_event_occurred_at=excluded.source_event_occurred_at,
           generated_at=excluded.generated_at,
           build_duration_ms=excluded.build_duration_ms,
           payload=excluded.payload
         WHERE app.dashboard_snapshots.snapshot_version<=excluded.snapshot_version`,
        [tenantId, refresh.module, refresh.scope_key, refresh.requested_version,
          refresh.reason_event_id, refresh.reason_event_occurred_at, durationMs, JSON.stringify(payload)],
      );
      const completed = await client.query(
        `DELETE FROM app.dashboard_refresh_queue
          WHERE tenant_id=$1 AND module=$2 AND scope_key=$3 AND lock_owner=$4
            AND requested_version=$5`,
        [tenantId, refresh.module, refresh.scope_key, workerId, refresh.requested_version],
      );
      if (completed.rowCount === 0) {
        await client.query(
          `UPDATE app.dashboard_refresh_queue SET locked_at=NULL,lock_owner=NULL,available_at=now()
            WHERE tenant_id=$1 AND module=$2 AND scope_key=$3 AND lock_owner=$4`,
          [tenantId, refresh.module, refresh.scope_key, workerId],
        );
      }
    });
  }

  private async releaseForRetry(
    tenantId: string,
    workerId: string,
    refresh: ClaimedRefresh,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown dashboard refresh error';
    await this.db.transaction(tenantId, async (client) => {
      await client.query(
        `UPDATE app.dashboard_refresh_queue
            SET locked_at=NULL,lock_owner=NULL,last_error=left($5,1000),
                available_at=now()+make_interval(secs=>LEAST(300,power(2,LEAST(attempts,8))::integer))
          WHERE tenant_id=$1 AND module=$2 AND scope_key=$3 AND lock_owner=$4`,
        [tenantId, refresh.module, refresh.scope_key, workerId, message],
      );
    });
  }

  private pending(tenantId: string): Promise<number> {
    return this.db.transaction(tenantId, async (client) => {
      const result = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM app.dashboard_refresh_queue WHERE tenant_id=$1', [tenantId]);
      return result.rows[0]?.count ?? 0;
    });
  }
}
