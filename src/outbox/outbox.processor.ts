import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';

interface ClaimedEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

export interface OutboxBatchResult {
  claimed: number;
  published: number;
  failed: number;
}

@Injectable()
export class OutboxProcessor {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async processTenant(
    tenantId: string,
    workerId = randomUUID(),
    batchSize = 25,
  ): Promise<OutboxBatchResult> {
    const events = await this.claim(tenantId, workerId, batchSize);
    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.project(tenantId, workerId, event);
        published += 1;
      } catch (error) {
        failed += 1;
        await this.releaseForRetry(tenantId, workerId, event.id, error);
      }
    }

    return { claimed: events.length, published, failed };
  }

  private claim(tenantId: string, workerId: string, batchSize: number): Promise<ClaimedEvent[]> {
    const safeBatchSize = Math.min(Math.max(Math.trunc(batchSize), 1), 100);
    return this.db.transaction(tenantId, async (client) => {
      const result = await client.query<ClaimedEvent>(
        `WITH candidates AS (
           SELECT tenant_id, id
             FROM app.outbox_events
            WHERE tenant_id = $1
              AND published_at IS NULL
              AND available_at <= now()
              AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes')
            ORDER BY occurred_at, id
            FOR UPDATE SKIP LOCKED
            LIMIT $2
         )
         UPDATE app.outbox_events AS event
            SET locked_at = now(), lock_owner = $3, attempts = event.attempts + 1
           FROM candidates
          WHERE (event.tenant_id, event.id) = (candidates.tenant_id, candidates.id)
         RETURNING event.id, event.event_type, event.aggregate_type, event.aggregate_id,
                   event.payload, event.occurred_at`,
        [tenantId, safeBatchSize, workerId],
      );
      return result.rows;
    });
  }

  private project(tenantId: string, workerId: string, event: ClaimedEvent): Promise<void> {
    return this.db.transaction(tenantId, async (client) => {
      await client.query(
        `INSERT INTO app.commercial_activity_read_model
           (tenant_id,event_id,event_type,aggregate_type,aggregate_id,payload,occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
         ON CONFLICT (tenant_id,event_id) DO NOTHING`,
        [tenantId, event.id, event.event_type, event.aggregate_type, event.aggregate_id,
          JSON.stringify(event.payload), event.occurred_at],
      );

      if (event.event_type === 'contract.activated') {
        await this.projectContractSummary(client, tenantId, event);
      }

      const acknowledged = await client.query(
        `UPDATE app.outbox_events
            SET published_at = now(), locked_at = NULL, lock_owner = NULL, last_error = NULL
          WHERE tenant_id = $1 AND id = $2 AND lock_owner = $3 AND published_at IS NULL`,
        [tenantId, event.id, workerId],
      );
      if (acknowledged.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
    });
  }

  private async projectContractSummary(client: PoolClient, tenantId: string, event: ClaimedEvent): Promise<void> {
    const result = await client.query(
      `INSERT INTO app.contract_summary_read_model
        (tenant_id,contract_id,offer_id,status,commodity,unit,quantity_sc,delivery_start,delivery_end,
         purchase_price_per_sc,sale_reference_per_sc,total_costs_per_sc,projected_margin_per_sc,
         policy_version,obligations,source_event_id)
       SELECT c.tenant_id,c.id,c.offer_id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,o.delivery_end,
              s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,s.projected_margin_per_sc,
              s.policy_version,
              COALESCE(jsonb_agg(jsonb_build_object('code',ob.code,'status',ob.status) ORDER BY ob.code)
                FILTER (WHERE ob.id IS NOT NULL),'[]'::jsonb),$3
         FROM app.contracts c
         JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
         JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id)
         LEFT JOIN app.contract_obligations ob ON (ob.tenant_id,ob.contract_id)=(c.tenant_id,c.id)
        WHERE c.tenant_id=$1 AND c.id=$2
        GROUP BY c.tenant_id,c.id,c.offer_id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,
                 o.delivery_end,s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,
                 s.projected_margin_per_sc,s.policy_version
       ON CONFLICT (tenant_id,contract_id) DO UPDATE SET
         status=excluded.status, commodity=excluded.commodity, unit=excluded.unit,
         quantity_sc=excluded.quantity_sc, delivery_start=excluded.delivery_start,
         delivery_end=excluded.delivery_end, purchase_price_per_sc=excluded.purchase_price_per_sc,
         sale_reference_per_sc=excluded.sale_reference_per_sc, total_costs_per_sc=excluded.total_costs_per_sc,
         projected_margin_per_sc=excluded.projected_margin_per_sc, policy_version=excluded.policy_version,
         obligations=excluded.obligations, source_event_id=excluded.source_event_id, projected_at=now()`,
      [tenantId, event.aggregate_id, event.id],
    );
    if (result.rowCount !== 1) throw new Error('CONTRACT_PROJECTION_SOURCE_NOT_FOUND');
  }

  private async releaseForRetry(
    tenantId: string,
    workerId: string,
    eventId: string,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown outbox processing error';
    await this.db.transaction(tenantId, async (client) => {
      await client.query(
        `UPDATE app.outbox_events
            SET locked_at = NULL,
                lock_owner = NULL,
                last_error = left($4, 1000),
                available_at = now() + make_interval(secs => LEAST(300, power(2, LEAST(attempts,8))::integer))
          WHERE tenant_id = $1 AND id = $2 AND lock_owner = $3 AND published_at IS NULL`,
        [tenantId, eventId, workerId, message],
      );
    });
  }
}
