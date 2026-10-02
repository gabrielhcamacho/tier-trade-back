import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type { RecordLoadReceiptInput, ScheduleLoadInput } from './operations.schemas.js';

interface ContractForScheduling {
  status: string;
  quantity_sc: string;
  delivery_start: string;
  delivery_end: string;
  timezone: string;
  scheduled_local_date: string;
  scheduled_at: Date;
}

interface LoadRow {
  id: string;
  contract_id: string;
  scheduled_at: Date;
  expected_weight_kg: string;
  vehicle_plate: string;
  carrier_name: string;
  destination_code: string;
  status: string;
  created_at: Date;
  timezone?: string;
}

interface ReceiptRow {
  id: string;
  version: number;
  received_at: Date;
  gross_weight_kg: string;
  tare_weight_kg: string;
  net_weight_kg: string;
  weighing_mode: string;
  scale_ticket_number: string | null;
  contingency_reason: string | null;
  moisture_pct: string;
  impurity_pct: string;
  damaged_pct: string;
  quality_decision: string;
  notes: string | null;
  created_at: Date;
}

@Injectable()
export class OperationsService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async scheduleLoad(tenantId: string, actorId: string, contractId: string, input: ScheduleLoadInput) {
    const expectedWeight = new Decimal(input.expectedWeightKg);
    if (!expectedWeight.isPositive()) {
      throw new UnprocessableEntityException({ code: 'LOAD_WEIGHT_MUST_BE_POSITIVE' });
    }

    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const contract = await this.contractForScheduling(client, tenantId, contractId, input.scheduledLocal);
      if (contract.status !== 'ACTIVE') throw new ConflictException({ code: 'CONTRACT_NOT_ACTIVE' });
      if (contract.scheduled_local_date < contract.delivery_start
        || contract.scheduled_local_date > contract.delivery_end) {
        throw new UnprocessableEntityException({
          code: 'LOAD_OUTSIDE_CONTRACT_DELIVERY_WINDOW',
          scheduledLocalDate: contract.scheduled_local_date,
          deliveryStart: contract.delivery_start,
          deliveryEnd: contract.delivery_end,
          timezone: contract.timezone,
        });
      }

      const scheduled = await client.query<{ scheduled_weight_kg: string }>(
        `SELECT COALESCE(sum(expected_weight_kg),0)::text AS scheduled_weight_kg
           FROM app.loads
          WHERE tenant_id=$1 AND contract_id=$2 AND status <> 'CANCELLED'`,
        [tenantId, contractId],
      );
      const contractWeight = new Decimal(contract.quantity_sc).mul(60);
      const scheduledWeight = new Decimal(scheduled.rows[0]?.scheduled_weight_kg ?? '0');
      const availableWeight = contractWeight.minus(scheduledWeight);
      if (expectedWeight.greaterThan(availableWeight)) {
        throw new UnprocessableEntityException({
          code: 'LOAD_EXCEEDS_CONTRACT_BALANCE',
          availableWeightKg: availableWeight.toFixed(3),
        });
      }

      const loadId = randomUUID();
      const result = await client.query<LoadRow>(
        `INSERT INTO app.loads
          (tenant_id,id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,
           carrier_name,destination_code,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SCHEDULED',$9)
         RETURNING id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,
                   carrier_name,destination_code,status,created_at`,
        [tenantId, loadId, contractId, contract.scheduled_at, input.expectedWeightKg,
          input.vehiclePlate, input.carrierName, input.destinationCode, actorId],
      );
      await this.record(client, tenantId, actorId, 'load.scheduled', loadId, {
        contractId,
        scheduledAt: contract.scheduled_at.toISOString(),
        scheduledLocal: input.scheduledLocal,
        expectedWeightKg: input.expectedWeightKg,
        destinationCode: input.destinationCode,
      });
      return {
        ...this.presentLoad(result.rows[0]!, contract.timezone),
        contractBalanceKg: availableWeight.minus(expectedWeight).toFixed(3),
      };
    });
  }

  listContractLoads(tenantId: string, actorId: string, contractId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const contract = await client.query<{ quantity_sc: string; status: string; timezone: string }>(
        `SELECT o.quantity_sc,c.status,t.timezone
           FROM app.contracts c JOIN app.offers o
             ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           JOIN app.tenants t ON t.id=c.tenant_id
          WHERE c.tenant_id=$1 AND c.id=$2`,
        [tenantId, contractId],
      );
      if (!contract.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
      const result = await client.query<LoadRow & { received_weight_kg: string }>(
        `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
                l.carrier_name,l.destination_code,l.status,l.created_at,
                COALESCE(r.net_weight_kg,0)::text AS received_weight_kg
           FROM app.loads l
           LEFT JOIN app.load_receipts r
             ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
          WHERE l.tenant_id=$1 AND l.contract_id=$2
          ORDER BY l.scheduled_at,l.id`,
        [tenantId, contractId],
      );
      const items = result.rows.map((row) => this.presentLoad(row, contract.rows[0]!.timezone));
      const scheduledWeight = result.rows
        .filter((row) => row.status !== 'CANCELLED')
        .reduce((total, row) => total.plus(row.expected_weight_kg), new Decimal(0));
      const contractWeight = new Decimal(contract.rows[0].quantity_sc).mul(60);
      const receivedWeight = result.rows
        .filter((row) => row.status === 'RECEIVED')
        .reduce((total, row) => total.plus(row.received_weight_kg), new Decimal(0));
      return {
        items,
        summary: {
          count: items.length,
          scheduledWeightKg: scheduledWeight.toFixed(3),
          receivedWeightKg: receivedWeight.toFixed(3),
          availableWeightKg: contractWeight.minus(scheduledWeight).toFixed(3),
        },
      };
    });
  }

  loadDetail(tenantId: string, actorId: string, loadId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<LoadRow>(
        `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
                l.carrier_name,l.destination_code,l.status,l.created_at,t.timezone
           FROM app.loads l JOIN app.tenants t ON t.id=l.tenant_id
          WHERE l.tenant_id=$1 AND l.id=$2`,
        [tenantId, loadId],
      );
      if (!result.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
      const receipts = await client.query<ReceiptRow>(
        `SELECT id,version,received_at,gross_weight_kg,tare_weight_kg,net_weight_kg,
                weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                impurity_pct,damaged_pct,quality_decision,notes,created_at
           FROM app.load_receipts
          WHERE tenant_id=$1 AND load_id=$2
          ORDER BY version DESC`,
        [tenantId, loadId],
      );
      const receiptHistory = receipts.rows.map((row) => this.presentReceipt(row));
      return {
        ...this.presentLoad(result.rows[0]),
        receipt: receiptHistory[0] ?? null,
        receiptHistory,
        events: [
          ...receiptHistory.map((receipt) => ({
            type: receipt.version === 1 ? 'load.receipt_recorded' : 'load.receipt_corrected',
            payload: {
              version: receipt.version,
              netWeightKg: receipt.netWeightKg,
              qualityDecision: receipt.qualityDecision,
            },
            occurredAt: receipt.createdAt,
          })),
          {
            type: 'load.scheduled',
            payload: { expectedWeightKg: result.rows[0]!.expected_weight_kg },
            occurredAt: result.rows[0]!.created_at.toISOString(),
          },
        ],
      };
    });
  }

  startReceiving(tenantId: string, actorId: string, loadId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await client.query<LoadRow>(
        `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
                l.carrier_name,l.destination_code,l.status,l.created_at,t.timezone
           FROM app.loads l JOIN app.tenants t ON t.id=l.tenant_id
          WHERE l.tenant_id=$1 AND l.id=$2 FOR UPDATE OF l`,
        [tenantId, loadId],
      );
      if (!load.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
      if (load.rows[0].status !== 'SCHEDULED') {
        throw new ConflictException({ code: 'LOAD_NOT_SCHEDULED', status: load.rows[0].status });
      }
      await client.query(
        `UPDATE app.loads SET status='IN_RECEIVING',updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [tenantId, loadId],
      );
      await this.record(client, tenantId, actorId, 'load.receiving_started', loadId, {
        previousStatus: 'SCHEDULED', status: 'IN_RECEIVING',
      });
      return { ...this.presentLoad(load.rows[0]), status: 'IN_RECEIVING' };
    });
  }

  recordReceipt(tenantId: string, actorId: string, loadId: string, input: RecordLoadReceiptInput) {
    const gross = new Decimal(input.grossWeightKg);
    const tare = new Decimal(input.tareWeightKg);
    if (!gross.greaterThan(tare)) {
      throw new UnprocessableEntityException({ code: 'GROSS_WEIGHT_MUST_EXCEED_TARE' });
    }
    const net = gross.minus(tare);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await client.query<LoadRow>(
        `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
                l.carrier_name,l.destination_code,l.status,l.created_at,t.timezone
           FROM app.loads l JOIN app.tenants t ON t.id=l.tenant_id
          WHERE l.tenant_id=$1 AND l.id=$2 FOR UPDATE OF l`,
        [tenantId, loadId],
      );
      if (!load.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
      if (!['IN_RECEIVING', 'RECEIVED'].includes(load.rows[0].status)) {
        throw new ConflictException({ code: 'LOAD_NOT_IN_RECEIVING', status: load.rows[0].status });
      }

      const previous = await client.query<ReceiptRow>(
        `SELECT id,version,received_at,gross_weight_kg,tare_weight_kg,net_weight_kg,
                weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                impurity_pct,damaged_pct,quality_decision,notes,created_at
           FROM app.load_receipts
          WHERE tenant_id=$1 AND load_id=$2 AND is_current=true
          FOR UPDATE`,
        [tenantId, loadId],
      );
      const version = (previous.rows[0]?.version ?? 0) + 1;
      if (previous.rows[0]) {
        await client.query(
          `UPDATE app.load_receipts SET is_current=false
            WHERE tenant_id=$1 AND load_id=$2 AND is_current=true`,
          [tenantId, loadId],
        );
      }
      const receipt = await client.query<ReceiptRow>(
        `INSERT INTO app.load_receipts
          (tenant_id,id,load_id,version,received_at,gross_weight_kg,tare_weight_kg,
           weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,impurity_pct,
           damaged_pct,quality_decision,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id,version,received_at,gross_weight_kg,tare_weight_kg,net_weight_kg,
                   weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                   impurity_pct,damaged_pct,quality_decision,notes,created_at`,
        [tenantId, randomUUID(), loadId, version, input.receivedAt, input.grossWeightKg,
          input.tareWeightKg, input.weighingMode, input.scaleTicketNumber,
          input.weighingMode === 'MANUAL_CONTINGENCY' ? input.contingencyReason : null,
          input.moisturePct, input.impurityPct, input.damagedPct, input.qualityDecision,
          input.notes, actorId],
      );
      const nextStatus = input.qualityDecision === 'ACCEPTED' ? 'RECEIVED' : 'IN_RECEIVING';
      await client.query(
        `UPDATE app.loads SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, loadId, nextStatus],
      );
      const eventType = previous.rows[0] ? 'load.receipt_corrected' : 'load.receipt_recorded';
      await this.record(client, tenantId, actorId, eventType, loadId, {
        version,
        previousVersion: previous.rows[0]?.version ?? null,
        previousStatus: load.rows[0].status,
        status: nextStatus,
        netWeightKg: net.toFixed(3),
        weighingMode: input.weighingMode,
        qualityDecision: input.qualityDecision,
      });
      return {
        ...this.presentLoad(load.rows[0]),
        status: nextStatus,
        receipt: this.presentReceipt(receipt.rows[0]!),
      };
    });
  }

  private async contractForScheduling(client: PoolClient, tenantId: string, contractId: string,
    scheduledLocal: string) {
    const result = await client.query<ContractForScheduling>(
      `SELECT c.status,o.quantity_sc,o.delivery_start::text,o.delivery_end::text,t.timezone,
              ($3::timestamp AT TIME ZONE t.timezone) AS scheduled_at,
              $3::date::text AS scheduled_local_date
         FROM app.contracts c
         JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
         JOIN app.tenants t ON t.id=c.tenant_id
        WHERE c.tenant_id=$1 AND c.id=$2
        FOR UPDATE OF c`,
      [tenantId, contractId, scheduledLocal],
    );
    if (!result.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
    return result.rows[0];
  }

  private presentLoad(row: LoadRow, timezone = row.timezone) {
    return {
      id: row.id,
      contractId: row.contract_id,
      scheduledAt: row.scheduled_at.toISOString(),
      timezone,
      expectedWeightKg: row.expected_weight_kg,
      vehiclePlate: row.vehicle_plate,
      carrierName: row.carrier_name,
      destinationCode: row.destination_code,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  private presentReceipt(row: ReceiptRow) {
    return {
      id: row.id,
      version: row.version,
      receivedAt: row.received_at.toISOString(),
      grossWeightKg: row.gross_weight_kg,
      tareWeightKg: row.tare_weight_kg,
      netWeightKg: row.net_weight_kg,
      weighingMode: row.weighing_mode,
      scaleTicketNumber: row.scale_ticket_number,
      contingencyReason: row.contingency_reason,
      moisturePct: row.moisture_pct,
      impurityPct: row.impurity_pct,
      damagedPct: row.damaged_pct,
      qualityDecision: row.quality_decision,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true`,
      [tenantId, actorId],
    );
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true
        AND $3=ANY(capabilities)`,
      [tenantId, actorId, capability],
    );
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
  }

  private async record(client: PoolClient, tenantId: string, actorId: string,
    eventType: string, loadId: string, payload: object) {
    const eventId = randomUUID();
    await client.query(
      `INSERT INTO app.audit_events (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,'load',$5,$6::jsonb)`,
      [tenantId, eventId, actorId, eventType, loadId, JSON.stringify(payload)],
    );
    await client.query(
      `INSERT INTO app.outbox_events (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,'load',$4,$5::jsonb)`,
      [tenantId, eventId, eventType, loadId, JSON.stringify(payload)],
    );
  }
}
