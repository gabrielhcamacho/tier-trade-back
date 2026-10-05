import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { InventoryReceiptPort } from '../inventory/inventory.port.js';
import type {
  CancelLoadInput,
  CreateLoadOccurrenceInput,
  RecordLoadReceiptInput,
  RecordYardEventInput,
  RescheduleLoadInput,
  ResolveLoadOccurrenceInput,
  ScheduleLoadInput,
} from './operations.schemas.js';

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
  inbound_invoice_number: string | null;
  inbound_invoice_series: string | null;
  inbound_invoice_access_key: string | null;
  document_weight_kg: string | null;
  considered_weight_kg: string | null;
  accepted_weight_kg: string | null;
  weight_decision_reason: string | null;
  weighing_mode: string;
  scale_ticket_number: string | null;
  contingency_reason: string | null;
  moisture_pct: string;
  impurity_pct: string;
  damaged_pct: string;
  broken_pct: string;
  burnt_pct: string;
  heat_damaged_pct: string;
  quality_decision: string;
  notes: string | null;
  created_at: Date;
}

interface YardEventRow {
  id: string;
  event_type: string;
  location_code: string | null;
  occurred_at: Date;
  notes: string | null;
  created_at: Date;
}

interface OccurrenceRow {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  occurred_at: Date;
  status: string;
  resolution: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ReceiptReportRow {
  id: string;
  receipt_id: string;
  reference: string;
  version: number;
  is_current: boolean;
  issued_at: Date;
  inbound_invoice_number: string;
  inbound_invoice_series: string;
  inbound_invoice_access_key: string | null;
  document_weight_kg: string;
  arrival_weight_kg: string;
  considered_weight_kg: string;
  accepted_weight_kg: string;
  scale_ticket_number: string | null;
  moisture_pct: string;
  impurity_pct: string;
  damaged_pct: string;
  broken_pct: string;
  burnt_pct: string;
  heat_damaged_pct: string;
  created_at: Date;
}

interface OperationalBoardRow extends LoadRow {
  timezone: string;
  receipt_id: string | null;
  receipt_version: number | null;
  received_at: Date | null;
  inbound_invoice_number: string | null;
  document_weight_kg: string | null;
  arrival_weight_kg: string | null;
  considered_weight_kg: string | null;
  accepted_weight_kg: string | null;
  scale_ticket_number: string | null;
  moisture_pct: string | null;
  impurity_pct: string | null;
  damaged_pct: string | null;
  broken_pct: string | null;
  burnt_pct: string | null;
  heat_damaged_pct: string | null;
  quality_decision: string | null;
  open_occurrences: number;
}

@Injectable()
export class OperationsService {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(InventoryReceiptPort) private readonly inventory: InventoryReceiptPort,
  ) {}

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

  async rescheduleLoad(tenantId: string, actorId: string, loadId: string, input: RescheduleLoadInput) {
    const expectedWeight = new Decimal(input.expectedWeightKg);
    if (!expectedWeight.isPositive()) {
      throw new UnprocessableEntityException({ code: 'LOAD_WEIGHT_MUST_BE_POSITIVE' });
    }
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await this.lockScheduledLoad(client, tenantId, loadId, input.scheduledLocal);
      const contract = load.contract;
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
          WHERE tenant_id=$1 AND contract_id=$2 AND id<>$3 AND status<>'CANCELLED'`,
        [tenantId, load.row.contract_id, loadId],
      );
      const availableWeight = new Decimal(contract.quantity_sc).mul(60)
        .minus(scheduled.rows[0]?.scheduled_weight_kg ?? '0');
      if (expectedWeight.greaterThan(availableWeight)) {
        throw new UnprocessableEntityException({
          code: 'LOAD_EXCEEDS_CONTRACT_BALANCE',
          availableWeightKg: availableWeight.toFixed(3),
        });
      }
      const updated = await client.query<LoadRow>(
        `UPDATE app.loads
            SET scheduled_at=$3,expected_weight_kg=$4,vehicle_plate=$5,carrier_name=$6,
                destination_code=$7,updated_at=now()
          WHERE tenant_id=$1 AND id=$2
          RETURNING id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,
                    carrier_name,destination_code,status,created_at`,
        [tenantId, loadId, contract.scheduled_at, input.expectedWeightKg,
          input.vehiclePlate, input.carrierName, input.destinationCode],
      );
      await this.record(client, tenantId, actorId, 'load.rescheduled', loadId, {
        reason: input.reason,
        previous: this.scheduleSnapshot(load.row),
        current: this.scheduleSnapshot(updated.rows[0]!),
      });
      return {
        ...this.presentLoad(updated.rows[0]!, contract.timezone),
        contractBalanceKg: availableWeight.minus(expectedWeight).toFixed(3),
      };
    });
  }

  async cancelLoad(tenantId: string, actorId: string, loadId: string, input: CancelLoadInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await this.lockScheduledLoad(client, tenantId, loadId, '2000-01-01T00:00');
      const updated = await client.query<LoadRow>(
        `UPDATE app.loads SET status='CANCELLED',updated_at=now()
          WHERE tenant_id=$1 AND id=$2
          RETURNING id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,
                    carrier_name,destination_code,status,created_at`,
        [tenantId, loadId],
      );
      await this.record(client, tenantId, actorId, 'load.cancelled', loadId, {
        reason: input.reason,
        previous: this.scheduleSnapshot(load.row),
        releasedWeightKg: load.row.expected_weight_kg,
      });
      return this.presentLoad(updated.rows[0]!, load.contract.timezone);
    });
  }

  private async lockScheduledLoad(client: PoolClient, tenantId: string, loadId: string,
    scheduledLocal: string): Promise<{ row: LoadRow; contract: ContractForScheduling }> {
    // Lock the contract before the load: scheduling uses the same order and serializes balance checks.
    const target = await client.query<{ contract_id: string }>(
      `SELECT contract_id FROM app.loads WHERE tenant_id=$1 AND id=$2`, [tenantId, loadId],
    );
    if (!target.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
    const contract = await this.contractForScheduling(client, tenantId,
      target.rows[0].contract_id, scheduledLocal);
    const result = await client.query<LoadRow>(
      `SELECT id,contract_id,scheduled_at,expected_weight_kg,vehicle_plate,
              carrier_name,destination_code,status,created_at
         FROM app.loads WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
      [tenantId, loadId],
    );
    const row = result.rows[0];
    if (!row || row.contract_id !== target.rows[0].contract_id) {
      throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
    }
    if (row.status !== 'SCHEDULED') {
      throw new ConflictException({ code: 'LOAD_NOT_SCHEDULED', status: row.status });
    }
    const receipts = await client.query(
      `SELECT 1 FROM app.load_receipts WHERE tenant_id=$1 AND load_id=$2 LIMIT 1`,
      [tenantId, loadId],
    );
    if (receipts.rowCount) throw new ConflictException({ code: 'LOAD_HAS_RECEIPT' });
    return { row, contract };
  }

  private scheduleSnapshot(row: LoadRow) {
    return {
      scheduledAt: row.scheduled_at.toISOString(),
      expectedWeightKg: row.expected_weight_kg,
      vehiclePlate: row.vehicle_plate,
      carrierName: row.carrier_name,
      destinationCode: row.destination_code,
    };
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
                COALESCE(r.accepted_weight_kg,r.net_weight_kg,0)::text AS received_weight_kg
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

  yardBoard(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<LoadRow & {
        yard_state: string | null;
        yard_occurred_at: Date | null;
        yard_location_code: string | null;
        open_occurrences: number;
      }>(
        `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
                l.carrier_name,l.destination_code,l.status,l.created_at,t.timezone,
                yard.event_type AS yard_state,yard.occurred_at AS yard_occurred_at,
                yard.location_code AS yard_location_code,
                count(o.id) FILTER (WHERE o.status='OPEN')::int AS open_occurrences
           FROM app.loads l
           JOIN app.tenants t ON t.id=l.tenant_id
           LEFT JOIN LATERAL (
             SELECT event_type,occurred_at,location_code FROM app.load_yard_events y
              WHERE y.tenant_id=l.tenant_id AND y.load_id=l.id
              ORDER BY occurred_at DESC,id DESC LIMIT 1
           ) yard ON true
           LEFT JOIN app.load_occurrences o
             ON (o.tenant_id,o.load_id)=(l.tenant_id,l.id)
          WHERE l.tenant_id=$1 AND l.status <> 'CANCELLED'
          GROUP BY l.tenant_id,l.id,t.timezone,yard.event_type,yard.occurred_at,yard.location_code
          ORDER BY CASE WHEN yard.event_type IS NULL THEN 0 WHEN yard.event_type='DEPARTED' THEN 2 ELSE 1 END,
                   COALESCE(yard.occurred_at,l.scheduled_at),l.id`,
        [tenantId],
      );
      const items = result.rows.map((row) => ({
        ...this.presentLoad(row),
        yardState: row.yard_state ?? 'NOT_ARRIVED',
        yardOccurredAt: row.yard_occurred_at?.toISOString() ?? null,
        yardLocationCode: row.yard_location_code,
        openOccurrences: row.open_occurrences,
      }));
      return {
        items,
        summary: {
          awaitingArrival: items.filter((item) => item.yardState === 'NOT_ARRIVED').length,
          inYard: items.filter((item) => !['NOT_ARRIVED', 'DEPARTED'].includes(item.yardState)).length,
          departed: items.filter((item) => item.yardState === 'DEPARTED').length,
          openOccurrences: items.reduce((total, item) => total + item.openOccurrences, 0),
        },
      };
    });
  }

  occurrenceBoard(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<OccurrenceRow & {
        load_id: string;
        vehicle_plate: string;
        contract_id: string;
        timezone: string;
      }>(
        `SELECT o.id,o.load_id,o.category,o.severity,o.title,o.description,o.occurred_at,
                o.status,o.resolution,o.resolved_at,o.created_at,o.updated_at,
                l.vehicle_plate,l.contract_id,t.timezone
           FROM app.load_occurrences o
           JOIN app.loads l ON (l.tenant_id,l.id)=(o.tenant_id,o.load_id)
           JOIN app.tenants t ON t.id=o.tenant_id
          WHERE o.tenant_id=$1
          ORDER BY CASE o.status WHEN 'OPEN' THEN 0 ELSE 1 END,
                   CASE o.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
                   o.occurred_at DESC,o.id DESC`,
        [tenantId],
      );
      const items = result.rows.map((row) => ({
        ...this.presentOccurrence(row),
        loadId: row.load_id,
        vehiclePlate: row.vehicle_plate,
        contractId: row.contract_id,
        timezone: row.timezone,
      }));
      return {
        items,
        summary: {
          open: items.filter((item) => item.status === 'OPEN').length,
          critical: items.filter((item) => item.status === 'OPEN' && item.severity === 'CRITICAL').length,
          resolved: items.filter((item) => item.status === 'RESOLVED').length,
        },
      };
    });
  }

  receivingBoard(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const items = await this.operationalBoardItems(client, tenantId);
      const acceptedWeight = items.reduce(
        (total, item) => total.plus(item.receipt?.acceptedWeightKg ?? 0), new Decimal(0),
      );
      return {
        items,
        summary: {
          scheduled: items.filter((item) => item.status === 'SCHEDULED').length,
          inReceiving: items.filter((item) => item.status === 'IN_RECEIVING').length,
          received: items.filter((item) => item.status === 'RECEIVED').length,
          acceptedWeightKg: acceptedWeight.toFixed(3),
        },
      };
    });
  }

  qualityBoard(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const items = await this.operationalBoardItems(client, tenantId);
      const classified = items.filter((item) => item.receipt);
      const average = (field: 'moisturePct' | 'impurityPct') => classified.length
        ? classified.reduce((total, item) => total.plus(item.receipt?.[field] ?? 0), new Decimal(0))
          .div(classified.length).toFixed(4)
        : '0.0000';
      return {
        items,
        summary: {
          awaitingClassification: items.filter((item) => !item.receipt).length,
          reviewRequired: items.filter((item) => item.receipt?.qualityDecision === 'REVIEW_REQUIRED').length,
          accepted: items.filter((item) => item.receipt?.qualityDecision === 'ACCEPTED').length,
          averageMoisturePct: average('moisturePct'),
          averageImpurityPct: average('impurityPct'),
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
                inbound_invoice_number,inbound_invoice_series,inbound_invoice_access_key,
                document_weight_kg,considered_weight_kg,accepted_weight_kg,weight_decision_reason,
                weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,quality_decision,notes,created_at
           FROM app.load_receipts
          WHERE tenant_id=$1 AND load_id=$2
          ORDER BY version DESC`,
        [tenantId, loadId],
      );
      const yardEvents = await client.query<YardEventRow>(
        `SELECT id,event_type,location_code,occurred_at,notes,created_at
           FROM app.load_yard_events
          WHERE tenant_id=$1 AND load_id=$2
          ORDER BY occurred_at,id`,
        [tenantId, loadId],
      );
      const occurrences = await client.query<OccurrenceRow>(
        `SELECT id,category,severity,title,description,occurred_at,status,resolution,
                resolved_at,created_at,updated_at
           FROM app.load_occurrences
          WHERE tenant_id=$1 AND load_id=$2
          ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END,occurred_at DESC,id DESC`,
        [tenantId, loadId],
      );
      const reports = await client.query<ReceiptReportRow>(
        `SELECT id,receipt_id,reference,version,is_current,issued_at,inbound_invoice_number,
                inbound_invoice_series,inbound_invoice_access_key,document_weight_kg,
                arrival_weight_kg,considered_weight_kg,accepted_weight_kg,scale_ticket_number,
                moisture_pct,impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,created_at
           FROM app.load_receipt_reports
          WHERE tenant_id=$1 AND load_id=$2
          ORDER BY version DESC`,
        [tenantId, loadId],
      );
      const receiptHistory = receipts.rows.map((row) => this.presentReceipt(row));
      const audit = await client.query<{ event_type: string; payload: Record<string, unknown>; occurred_at: Date }>(
        `SELECT event_type,payload,occurred_at FROM app.audit_events
          WHERE tenant_id=$1 AND aggregate_type='load' AND aggregate_id=$2
            AND (payload->>'seeded'='true' OR occurred_at > COALESCE((
              SELECT max(occurred_at) FROM app.audit_events
               WHERE tenant_id=$1 AND event_type='demo.seed_reset'
            ),'-infinity'::timestamptz))
          ORDER BY occurred_at DESC,id DESC`,
        [tenantId, loadId],
      );
      const seededEvents = new Set<string>();
      return {
        ...this.presentLoad(result.rows[0]),
        receipt: receiptHistory[0] ?? null,
        receiptHistory,
        yardState: yardEvents.rows.at(-1)?.event_type ?? 'NOT_ARRIVED',
        yardEvents: yardEvents.rows.map((row) => this.presentYardEvent(row)),
        occurrences: occurrences.rows.map((row) => this.presentOccurrence(row)),
        romaneio: reports.rows[0] ? this.presentReceiptReport(reports.rows[0]) : null,
        romaneioHistory: reports.rows.map((row) => this.presentReceiptReport(row)),
        events: audit.rows.filter((event) => {
          if (event.payload.seeded !== true) return true;
          const key = `${event.event_type}:${JSON.stringify(event.payload)}`;
          if (seededEvents.has(key)) return false;
          seededEvents.add(key);
          return true;
        }).map((event) => ({
          type: event.event_type,
          payload: event.payload,
          occurredAt: event.occurred_at.toISOString(),
        })),
      };
    });
  }

  private async operationalBoardItems(client: PoolClient, tenantId: string) {
    const result = await client.query<OperationalBoardRow>(
      `SELECT l.id,l.contract_id,l.scheduled_at,l.expected_weight_kg,l.vehicle_plate,
              l.carrier_name,l.destination_code,l.status,l.created_at,t.timezone,
              r.id AS receipt_id,r.version AS receipt_version,r.received_at,
              r.inbound_invoice_number,r.document_weight_kg,
              (r.gross_weight_kg-r.tare_weight_kg)::text AS arrival_weight_kg,
              r.considered_weight_kg,r.accepted_weight_kg,r.scale_ticket_number,
              r.moisture_pct,r.impurity_pct,r.damaged_pct,r.broken_pct,r.burnt_pct,
              r.heat_damaged_pct,r.quality_decision,
              count(o.id) FILTER (WHERE o.status='OPEN')::int AS open_occurrences
         FROM app.loads l
         JOIN app.tenants t ON t.id=l.tenant_id
         LEFT JOIN app.load_receipts r
           ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
         LEFT JOIN app.load_occurrences o
           ON (o.tenant_id,o.load_id)=(l.tenant_id,l.id)
        WHERE l.tenant_id=$1 AND l.status<>'CANCELLED'
        GROUP BY l.tenant_id,l.id,t.timezone,r.id,r.version,r.received_at,
                 r.inbound_invoice_number,r.document_weight_kg,r.gross_weight_kg,
                 r.tare_weight_kg,r.considered_weight_kg,r.accepted_weight_kg,
                 r.scale_ticket_number,r.moisture_pct,r.impurity_pct,r.damaged_pct,
                 r.broken_pct,r.burnt_pct,r.heat_damaged_pct,
                 r.quality_decision
        ORDER BY CASE l.status WHEN 'IN_RECEIVING' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
                 l.scheduled_at,l.id`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      ...this.presentLoad(row),
      openOccurrences: row.open_occurrences,
      receipt: row.receipt_id ? {
        id: row.receipt_id,
        version: row.receipt_version!,
        receivedAt: row.received_at!.toISOString(),
        inboundInvoiceNumber: row.inbound_invoice_number,
        documentWeightKg: row.document_weight_kg,
        arrivalWeightKg: row.arrival_weight_kg,
        consideredWeightKg: row.considered_weight_kg,
        acceptedWeightKg: row.accepted_weight_kg,
        scaleTicketNumber: row.scale_ticket_number,
        moisturePct: row.moisture_pct,
        impurityPct: row.impurity_pct,
        damagedPct: row.damaged_pct,
        brokenPct: row.broken_pct,
        burntPct: row.burnt_pct,
        heatDamagedPct: row.heat_damaged_pct,
        qualityDecision: row.quality_decision,
      } : null,
    }));
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
      const yardEventId = randomUUID();
      await client.query(
        `INSERT INTO app.load_yard_events
          (tenant_id,id,load_id,event_type,occurred_at,created_by)
         VALUES ($1,$2,$3,'CHECKED_IN',now(),$4)`,
        [tenantId, yardEventId, loadId, actorId],
      );
      await this.record(client, tenantId, actorId, 'load.receiving_started', loadId, {
        previousStatus: 'SCHEDULED', status: 'IN_RECEIVING', yardEventId,
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
    const documentWeight = new Decimal(input.documentWeightKg);
    const consideredWeight = new Decimal(input.consideredWeightKg);
    const acceptedWeight = input.acceptedWeightKg === null ? null : new Decimal(input.acceptedWeightKg);
    const weightsDiffer = !documentWeight.equals(consideredWeight)
      || !net.equals(consideredWeight)
      || (acceptedWeight !== null && !acceptedWeight.equals(consideredWeight));
    if (weightsDiffer && input.weightDecisionReason === null) {
      throw new UnprocessableEntityException({ code: 'WEIGHT_DIFFERENCE_REASON_REQUIRED' });
    }
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
                inbound_invoice_number,inbound_invoice_series,inbound_invoice_access_key,
                document_weight_kg,considered_weight_kg,accepted_weight_kg,weight_decision_reason,
                weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,quality_decision,notes,created_at
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
      const receiptId = randomUUID();
      const receipt = await client.query<ReceiptRow>(
        `INSERT INTO app.load_receipts
          (tenant_id,id,load_id,version,received_at,inbound_invoice_number,inbound_invoice_series,
           inbound_invoice_access_key,document_weight_kg,gross_weight_kg,tare_weight_kg,
           considered_weight_kg,accepted_weight_kg,weight_decision_reason,weighing_mode,
           scale_ticket_number,contingency_reason,moisture_pct,impurity_pct,damaged_pct,
           broken_pct,burnt_pct,heat_damaged_pct,quality_decision,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
         RETURNING id,version,received_at,gross_weight_kg,tare_weight_kg,net_weight_kg,
                   inbound_invoice_number,inbound_invoice_series,inbound_invoice_access_key,
                   document_weight_kg,considered_weight_kg,accepted_weight_kg,weight_decision_reason,
                   weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                   impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,quality_decision,notes,created_at`,
        [tenantId, receiptId, loadId, version, input.receivedAt, input.inboundInvoiceNumber,
          input.inboundInvoiceSeries, input.inboundInvoiceAccessKey, input.documentWeightKg,
          input.grossWeightKg, input.tareWeightKg, input.consideredWeightKg,
          input.acceptedWeightKg, weightsDiffer ? input.weightDecisionReason : null,
          input.weighingMode, input.scaleTicketNumber,
          input.weighingMode === 'MANUAL_CONTINGENCY' ? input.contingencyReason : null,
          input.moisturePct, input.impurityPct, input.damagedPct, input.brokenPct,
          input.burntPct, input.heatDamagedPct, input.qualityDecision, input.notes, actorId],
      );
      const nextStatus = input.qualityDecision === 'ACCEPTED' ? 'RECEIVED' : 'IN_RECEIVING';
      await client.query(
        `UPDATE app.loads SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, loadId, nextStatus],
      );
      await this.inventory.applyReceipt(client, {
        tenantId,
        actorId,
        loadId,
        contractId: load.rows[0].contract_id,
        destinationCode: load.rows[0].destination_code,
        receiptId,
        receivedAt: new Date(input.receivedAt),
        previousAcceptedWeightKg: previous.rows[0]?.quality_decision === 'ACCEPTED'
          ? previous.rows[0].accepted_weight_kg ?? previous.rows[0].net_weight_kg
          : '0',
        nextAcceptedWeightKg: input.qualityDecision === 'ACCEPTED' ? input.acceptedWeightKg! : '0',
      });
      const eventType = previous.rows[0] ? 'load.receipt_corrected' : 'load.receipt_recorded';
      await this.record(client, tenantId, actorId, eventType, loadId, {
        version,
        previousVersion: previous.rows[0]?.version ?? null,
        previousStatus: load.rows[0].status,
        status: nextStatus,
        inboundInvoiceNumber: input.inboundInvoiceNumber,
        documentWeightKg: documentWeight.toFixed(3),
        arrivalWeightKg: net.toFixed(3),
        consideredWeightKg: consideredWeight.toFixed(3),
        acceptedWeightKg: acceptedWeight?.toFixed(3) ?? null,
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

  recordYardEvent(tenantId: string, actorId: string, loadId: string, input: RecordYardEventInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await client.query<{ status: string }>(
        `SELECT status FROM app.loads WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, loadId],
      );
      if (!load.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
      if (load.rows[0].status === 'CANCELLED') {
        throw new ConflictException({ code: 'YARD_EVENT_LOAD_CANCELLED' });
      }
      const latest = await client.query<{ event_type: string; occurred_at: Date }>(
        `SELECT event_type,occurred_at FROM app.load_yard_events
          WHERE tenant_id=$1 AND load_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE`,
        [tenantId, loadId],
      );
      const previous = latest.rows[0]?.event_type ?? 'NOT_ARRIVED';
      const expectedPrevious: Record<RecordYardEventInput['eventType'], string> = {
        QUEUED: 'CHECKED_IN', CALLED_TO_SCALE: 'QUEUED', RELEASED: 'CALLED_TO_SCALE', DEPARTED: 'RELEASED',
      };
      if (previous !== expectedPrevious[input.eventType]) {
        throw new ConflictException({ code: 'INVALID_YARD_TRANSITION', previous, requested: input.eventType });
      }
      if (latest.rows[0] && new Date(input.occurredAt) < latest.rows[0].occurred_at) {
        throw new UnprocessableEntityException({ code: 'YARD_EVENT_OUT_OF_ORDER' });
      }
      if (input.eventType === 'RELEASED' && load.rows[0].status !== 'RECEIVED') {
        throw new ConflictException({ code: 'YARD_RELEASE_REQUIRES_ACCEPTED_RECEIPT' });
      }
      const eventId = randomUUID();
      const result = await client.query<YardEventRow>(
        `INSERT INTO app.load_yard_events
          (tenant_id,id,load_id,event_type,location_code,occurred_at,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,event_type,location_code,occurred_at,notes,created_at`,
        [tenantId, eventId, loadId, input.eventType, input.locationCode, input.occurredAt, input.notes, actorId],
      );
      await this.record(client, tenantId, actorId, 'load.yard_event_recorded', loadId, {
        yardEventId: eventId, previous, eventType: input.eventType,
        locationCode: input.locationCode, occurredAt: input.occurredAt,
      });
      return { yardState: input.eventType, event: this.presentYardEvent(result.rows[0]!) };
    });
  }

  createOccurrence(tenantId: string, actorId: string, loadId: string, input: CreateLoadOccurrenceInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const load = await client.query(`SELECT 1 FROM app.loads WHERE tenant_id=$1 AND id=$2`, [tenantId, loadId]);
      if (!load.rows[0]) throw new NotFoundException({ code: 'LOAD_NOT_FOUND' });
      const occurrenceId = randomUUID();
      const result = await client.query<OccurrenceRow>(
        `INSERT INTO app.load_occurrences
          (tenant_id,id,load_id,category,severity,title,description,occurred_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id,category,severity,title,description,occurred_at,status,resolution,
                   resolved_at,created_at,updated_at`,
        [tenantId, occurrenceId, loadId, input.category, input.severity, input.title,
          input.description, input.occurredAt, actorId],
      );
      await this.record(client, tenantId, actorId, 'load.occurrence_created', loadId, {
        occurrenceId, category: input.category, severity: input.severity, title: input.title,
      });
      return this.presentOccurrence(result.rows[0]!);
    });
  }

  resolveOccurrence(tenantId: string, actorId: string, loadId: string, occurrenceId: string,
    input: ResolveLoadOccurrenceInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const occurrence = await client.query<OccurrenceRow>(
        `SELECT id,category,severity,title,description,occurred_at,status,resolution,
                resolved_at,created_at,updated_at
           FROM app.load_occurrences
          WHERE tenant_id=$1 AND load_id=$2 AND id=$3 FOR UPDATE`,
        [tenantId, loadId, occurrenceId],
      );
      if (!occurrence.rows[0]) throw new NotFoundException({ code: 'LOAD_OCCURRENCE_NOT_FOUND' });
      if (occurrence.rows[0].status === 'RESOLVED') {
        throw new ConflictException({ code: 'LOAD_OCCURRENCE_ALREADY_RESOLVED' });
      }
      const result = await client.query<OccurrenceRow>(
        `UPDATE app.load_occurrences
            SET status='RESOLVED',resolution=$4,resolved_by=$5,resolved_at=now(),updated_at=now()
          WHERE tenant_id=$1 AND load_id=$2 AND id=$3
          RETURNING id,category,severity,title,description,occurred_at,status,resolution,
                    resolved_at,created_at,updated_at`,
        [tenantId, loadId, occurrenceId, input.resolution, actorId],
      );
      await this.record(client, tenantId, actorId, 'load.occurrence_resolved', loadId, {
        occurrenceId, resolution: input.resolution,
      });
      return this.presentOccurrence(result.rows[0]!);
    });
  }

  issueRomaneio(tenantId: string, actorId: string, loadId: string) {
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
      const receipt = await client.query<ReceiptRow>(
        `SELECT id,version,received_at,gross_weight_kg,tare_weight_kg,net_weight_kg,
                inbound_invoice_number,inbound_invoice_series,inbound_invoice_access_key,
                document_weight_kg,considered_weight_kg,accepted_weight_kg,weight_decision_reason,
                weighing_mode,scale_ticket_number,contingency_reason,moisture_pct,
                impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,quality_decision,notes,created_at
           FROM app.load_receipts
          WHERE tenant_id=$1 AND load_id=$2 AND is_current=true FOR UPDATE`,
        [tenantId, loadId],
      );
      const currentReceipt = receipt.rows[0];
      if (!currentReceipt || currentReceipt.quality_decision !== 'ACCEPTED') {
        throw new ConflictException({ code: 'ROMANEIO_REQUIRES_ACCEPTED_RECEIPT' });
      }
      if (!currentReceipt.inbound_invoice_number || !currentReceipt.inbound_invoice_series
        || !currentReceipt.document_weight_kg || !currentReceipt.considered_weight_kg
        || !currentReceipt.accepted_weight_kg) {
        throw new ConflictException({ code: 'ROMANEIO_RECEIPT_DATA_INCOMPLETE' });
      }
      const previous = await client.query<ReceiptReportRow>(
        `SELECT id,receipt_id,reference,version,is_current,issued_at,inbound_invoice_number,
                inbound_invoice_series,inbound_invoice_access_key,document_weight_kg,
                arrival_weight_kg,considered_weight_kg,accepted_weight_kg,scale_ticket_number,
                moisture_pct,impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,created_at
           FROM app.load_receipt_reports
          WHERE tenant_id=$1 AND load_id=$2 AND is_current=true FOR UPDATE`,
        [tenantId, loadId],
      );
      if (previous.rows[0]?.receipt_id === currentReceipt.id) {
        return this.presentReceiptReport(previous.rows[0]);
      }
      if (previous.rows[0]) {
        await client.query(
          `UPDATE app.load_receipt_reports SET is_current=false
            WHERE tenant_id=$1 AND load_id=$2 AND is_current=true`,
          [tenantId, loadId],
        );
      }
      const year = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', timeZone: load.rows[0].timezone,
      }).format(currentReceipt.received_at);
      const reference = `RM-${load.rows[0].destination_code}-${year}-${loadId.replaceAll('-', '').slice(-8).toUpperCase()}`;
      const version = (previous.rows[0]?.version ?? 0) + 1;
      const reportId = randomUUID();
      const result = await client.query<ReceiptReportRow>(
        `INSERT INTO app.load_receipt_reports
          (tenant_id,id,load_id,receipt_id,reference,version,issued_at,inbound_invoice_number,
           inbound_invoice_series,inbound_invoice_access_key,document_weight_kg,arrival_weight_kg,
           considered_weight_kg,accepted_weight_kg,scale_ticket_number,moisture_pct,impurity_pct,
           damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id,receipt_id,reference,version,is_current,issued_at,inbound_invoice_number,
                   inbound_invoice_series,inbound_invoice_access_key,document_weight_kg,
                   arrival_weight_kg,considered_weight_kg,accepted_weight_kg,scale_ticket_number,
                   moisture_pct,impurity_pct,damaged_pct,broken_pct,burnt_pct,heat_damaged_pct,created_at`,
        [tenantId, reportId, loadId, currentReceipt.id, reference, version,
          currentReceipt.inbound_invoice_number, currentReceipt.inbound_invoice_series,
          currentReceipt.inbound_invoice_access_key, currentReceipt.document_weight_kg,
          currentReceipt.net_weight_kg, currentReceipt.considered_weight_kg,
          currentReceipt.accepted_weight_kg, currentReceipt.scale_ticket_number,
          currentReceipt.moisture_pct, currentReceipt.impurity_pct, currentReceipt.damaged_pct,
          currentReceipt.broken_pct, currentReceipt.burnt_pct, currentReceipt.heat_damaged_pct, actorId],
      );
      const eventType = previous.rows[0] ? 'load.romaneio_corrected' : 'load.romaneio_issued';
      await this.record(client, tenantId, actorId, eventType, loadId, {
        romaneioId: reportId, reference, version, receiptId: currentReceipt.id,
        previousVersion: previous.rows[0]?.version ?? null,
      });
      return this.presentReceiptReport(result.rows[0]!);
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
      arrivalWeightKg: row.net_weight_kg,
      inboundInvoiceNumber: row.inbound_invoice_number,
      inboundInvoiceSeries: row.inbound_invoice_series,
      inboundInvoiceAccessKey: row.inbound_invoice_access_key,
      documentWeightKg: row.document_weight_kg,
      consideredWeightKg: row.considered_weight_kg,
      acceptedWeightKg: row.accepted_weight_kg,
      weightDecisionReason: row.weight_decision_reason,
      weighingMode: row.weighing_mode,
      scaleTicketNumber: row.scale_ticket_number,
      contingencyReason: row.contingency_reason,
      moisturePct: row.moisture_pct,
      impurityPct: row.impurity_pct,
      damagedPct: row.damaged_pct,
      brokenPct: row.broken_pct,
      burntPct: row.burnt_pct,
      heatDamagedPct: row.heat_damaged_pct,
      qualityDecision: row.quality_decision,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
    };
  }

  private presentYardEvent(row: YardEventRow) {
    return {
      id: row.id,
      eventType: row.event_type,
      locationCode: row.location_code,
      occurredAt: row.occurred_at.toISOString(),
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
    };
  }

  private presentOccurrence(row: OccurrenceRow) {
    return {
      id: row.id,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      occurredAt: row.occurred_at.toISOString(),
      status: row.status,
      resolution: row.resolution,
      resolvedAt: row.resolved_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private presentReceiptReport(row: ReceiptReportRow) {
    return {
      id: row.id,
      receiptId: row.receipt_id,
      reference: row.reference,
      version: row.version,
      isCurrent: row.is_current,
      issuedAt: row.issued_at.toISOString(),
      inboundInvoiceNumber: row.inbound_invoice_number,
      inboundInvoiceSeries: row.inbound_invoice_series,
      inboundInvoiceAccessKey: row.inbound_invoice_access_key,
      documentWeightKg: row.document_weight_kg,
      arrivalWeightKg: row.arrival_weight_kg,
      consideredWeightKg: row.considered_weight_kg,
      acceptedWeightKg: row.accepted_weight_kg,
      scaleTicketNumber: row.scale_ticket_number,
      moisturePct: row.moisture_pct,
      impurityPct: row.impurity_pct,
      damagedPct: row.damaged_pct,
      brokenPct: row.broken_pct,
      burntPct: row.burnt_pct,
      heatDamagedPct: row.heat_damaged_pct,
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
