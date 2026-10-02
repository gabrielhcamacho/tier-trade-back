import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { InventoryReceiptPort, type ApplyReceiptToInventoryInput } from './inventory.port.js';

interface LotPositionRow {
  id: string;
  lot_code: string;
  source_load_id: string;
  contract_id: string;
  location_code: string;
  location_name: string;
  commodity: string;
  status: string;
  ownership_status: string;
  risk_status: string;
  custody_status: string;
  quantity_kg: string;
  moisture_pct: string;
  impurity_pct: string;
  damaged_pct: string;
  vehicle_plate: string;
  created_at: Date;
}

interface MovementRow {
  id: string;
  lot_id: string;
  lot_code: string;
  source_load_id: string;
  source_receipt_id: string;
  movement_type: string;
  quantity_delta_kg: string;
  occurred_at: Date;
}

@Injectable()
export class InventoryService extends InventoryReceiptPort {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {
    super();
  }

  position(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await client.query<{
        legal_name: string;
        is_demo: boolean;
        demo_seed_version: number | null;
      }>(
        `SELECT legal_name,is_demo,demo_seed_version FROM app.tenants WHERE id=$1`,
        [tenantId],
      );
      const lots = await client.query<LotPositionRow>(
        `SELECT lot.id,lot.lot_code,lot.source_load_id,lot.contract_id,
                loc.code AS location_code,loc.name AS location_name,lot.commodity,lot.status,
                lot.ownership_status,lot.risk_status,lot.custody_status,
                COALESCE(sum(m.quantity_delta_kg),0)::text AS quantity_kg,
                r.moisture_pct::text,r.impurity_pct::text,r.damaged_pct::text,
                l.vehicle_plate,lot.created_at
           FROM app.inventory_lots lot
           JOIN app.inventory_locations loc
             ON (loc.tenant_id,loc.id)=(lot.tenant_id,lot.location_id)
           JOIN app.loads l ON (l.tenant_id,l.id)=(lot.tenant_id,lot.source_load_id)
           LEFT JOIN app.inventory_movements m
             ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
           LEFT JOIN app.load_receipts r
             ON (r.tenant_id,r.load_id)=(lot.tenant_id,lot.source_load_id) AND r.is_current=true
          WHERE lot.tenant_id=$1
          GROUP BY lot.id,lot.lot_code,lot.source_load_id,lot.contract_id,loc.code,loc.name,
                   lot.commodity,lot.status,lot.ownership_status,lot.risk_status,
                   lot.custody_status,r.moisture_pct,r.impurity_pct,r.damaged_pct,
                   l.vehicle_plate,lot.created_at
          ORDER BY loc.code,lot.lot_code`,
        [tenantId],
      );
      const movements = await client.query<MovementRow>(
        `SELECT m.id,m.lot_id,lot.lot_code,m.source_load_id,m.source_receipt_id,
                m.movement_type,m.quantity_delta_kg::text,m.occurred_at
           FROM app.inventory_movements m
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(m.tenant_id,m.lot_id)
          WHERE m.tenant_id=$1
          ORDER BY m.occurred_at DESC,m.id DESC`,
        [tenantId],
      );

      const physical = lots.rows.reduce(
        (total, row) => total.plus(row.quantity_kg),
        new Decimal(0),
      );
      const available = lots.rows
        .filter((row) => row.status === 'AVAILABLE')
        .reduce((total, row) => total.plus(row.quantity_kg), new Decimal(0));
      const blocked = physical.minus(available);
      return {
        tenant: {
          legalName: tenant.rows[0]!.legal_name,
          isDemo: tenant.rows[0]!.is_demo,
          demoSeedVersion: tenant.rows[0]!.demo_seed_version,
        },
        summary: {
          physicalWeightKg: physical.toFixed(3),
          availableWeightKg: available.toFixed(3),
          blockedWeightKg: blocked.toFixed(3),
          lotCount: lots.rowCount,
          pendingOwnershipCount: lots.rows.filter(
            (row) => row.ownership_status === 'PENDING_DEFINITION',
          ).length,
        },
        lots: lots.rows.map((row) => ({
          id: row.id,
          lotCode: row.lot_code,
          sourceLoadId: row.source_load_id,
          contractId: row.contract_id,
          location: { code: row.location_code, name: row.location_name },
          commodity: row.commodity,
          status: row.status,
          ownershipStatus: row.ownership_status,
          riskStatus: row.risk_status,
          custodyStatus: row.custody_status,
          quantityKg: row.quantity_kg,
          quality: {
            moisturePct: row.moisture_pct,
            impurityPct: row.impurity_pct,
            damagedPct: row.damaged_pct,
          },
          vehiclePlate: row.vehicle_plate,
          createdAt: row.created_at.toISOString(),
        })),
        movements: movements.rows.map((row) => ({
          id: row.id,
          lotId: row.lot_id,
          lotCode: row.lot_code,
          sourceLoadId: row.source_load_id,
          sourceReceiptId: row.source_receipt_id,
          type: row.movement_type,
          quantityDeltaKg: row.quantity_delta_kg,
          occurredAt: row.occurred_at.toISOString(),
        })),
      };
    });
  }

  async applyReceipt(client: PoolClient, input: ApplyReceiptToInventoryInput): Promise<void> {
    const previous = new Decimal(input.previousAcceptedWeightKg);
    const next = new Decimal(input.nextAcceptedWeightKg);
    const delta = next.minus(previous);
    if (previous.isZero() && next.isZero()) return;

    const commodity = await client.query<{ commodity: string }>(
      `SELECT o.commodity
         FROM app.contracts c
         JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
        WHERE c.tenant_id=$1 AND c.id=$2`,
      [input.tenantId, input.contractId],
    );
    if (!commodity.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });

    const locationId = randomUUID();
    const location = await client.query<{ id: string }>(
      `INSERT INTO app.inventory_locations (tenant_id,id,code,name,created_by)
       VALUES ($1,$2,$3,$3,$4)
       ON CONFLICT (tenant_id,code) DO UPDATE SET code=EXCLUDED.code
       RETURNING id`,
      [input.tenantId, locationId, input.destinationCode, input.actorId],
    );
    const lotId = randomUUID();
    const lotCode = `LT-${input.loadId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const lot = await client.query<{ id: string }>(
      `INSERT INTO app.inventory_lots
        (tenant_id,id,lot_code,source_load_id,contract_id,location_id,commodity,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id,source_load_id) DO UPDATE
         SET status=EXCLUDED.status,updated_at=now()
       RETURNING id`,
      [input.tenantId, lotId, lotCode, input.loadId, input.contractId, location.rows[0]!.id,
        commodity.rows[0].commodity, next.greaterThan(0) ? 'AVAILABLE' : 'BLOCKED_REVIEW', input.actorId],
    );

    if (delta.isZero()) return;
    const movementType = previous.isZero()
      ? 'RECEIPT'
      : next.isZero() ? 'RECEIPT_REVERSAL' : 'RECEIPT_CORRECTION';
    await client.query(
      `INSERT INTO app.inventory_movements
        (tenant_id,id,lot_id,source_load_id,source_receipt_id,movement_type,
         quantity_delta_kg,occurred_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.tenantId, randomUUID(), lot.rows[0]!.id, input.loadId, input.receiptId,
        movementType, delta.toFixed(3), input.receivedAt, input.actorId],
    );
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true`,
      [tenantId, actorId],
    );
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }
}
