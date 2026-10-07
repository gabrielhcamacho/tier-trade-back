import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { FinancialProjectionPort } from '../finance/finance.port.js';
import { InventoryReceiptPort, type ApplyReceiptToInventoryInput } from './inventory.port.js';
import type {
  AllocationInput, CompleteTransferInput, DispatchInput, InventoryCountInput,
  InventoryLocationInput, LossInput, LotClassificationInput, SalesContractInput, StartTransferInput,
} from './inventory.schemas.js';

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
  owner_counterparty_id: string | null;
  owner_counterparty_name: string | null;
  custodian_counterparty_id: string | null;
  custodian_counterparty_name: string | null;
  quantity_kg: string;
  committed_kg: string;
  available_kg: string;
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
  source_load_id: string | null;
  source_receipt_id: string | null;
  allocation_id: string | null;
  dispatch_id: string | null;
  movement_type: string;
  quantity_delta_kg: string;
  occurred_at: Date;
  created_at: Date;
}

const salesContractsSql = `SELECT sc.id,sc.counterparty_id,sc.reference,sc.commodity,sc.quantity_kg::text,
    sc.sale_price_per_kg::text,sc.destination_code,sc.delivery_start::text,sc.delivery_end::text,
    sc.required_documents,sc.payment_term_days,sc.status,cp.legal_name AS counterparty_name,
    COALESCE(a.allocated_kg,0)::text AS allocated_kg,
    COALESCE(a.dispatched_kg,0)::text AS dispatched_kg
  FROM app.sales_contracts sc
  JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(sc.tenant_id,sc.counterparty_id)
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(x.quantity_kg) FILTER (WHERE x.status<>'RELEASED'),0)::numeric(20,3) AS allocated_kg,
           COALESCE(sum(x.dispatched_kg),0)::numeric(20,3) AS dispatched_kg
      FROM (
        SELECT ia.quantity_kg,ia.status,COALESCE(sum(id.quantity_kg),0)::numeric(20,3) AS dispatched_kg
          FROM app.inventory_allocations ia
          LEFT JOIN app.inventory_dispatches id ON (id.tenant_id,id.allocation_id)=(ia.tenant_id,ia.id)
         WHERE ia.tenant_id=sc.tenant_id AND ia.sales_contract_id=sc.id
         GROUP BY ia.id,ia.quantity_kg,ia.status
      ) x
  ) a ON true
 WHERE sc.tenant_id=$1 ORDER BY sc.created_at DESC,sc.id DESC`;

@Injectable()
export class InventoryService extends InventoryReceiptPort {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(FinancialProjectionPort) private readonly finance: FinancialProjectionPort,
  ) {
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
                lot.owner_counterparty_id,owner.legal_name AS owner_counterparty_name,
                lot.custodian_counterparty_id,custodian.legal_name AS custodian_counterparty_name,
                COALESCE(sum(m.quantity_delta_kg),0)::text AS quantity_kg,
                COALESCE(allocation_totals.committed_kg,0)::text AS committed_kg,
                GREATEST(COALESCE(sum(m.quantity_delta_kg),0)-COALESCE(allocation_totals.committed_kg,0),0)::text AS available_kg,
                r.moisture_pct::text,r.impurity_pct::text,r.damaged_pct::text,
                l.vehicle_plate,lot.created_at
           FROM app.inventory_lots lot
           JOIN app.inventory_locations loc
             ON (loc.tenant_id,loc.id)=(lot.tenant_id,lot.location_id)
           JOIN app.loads l ON (l.tenant_id,l.id)=(lot.tenant_id,lot.source_load_id)
           LEFT JOIN app.counterparties owner
             ON (owner.tenant_id,owner.id)=(lot.tenant_id,lot.owner_counterparty_id)
           LEFT JOIN app.counterparties custodian
             ON (custodian.tenant_id,custodian.id)=(lot.tenant_id,lot.custodian_counterparty_id)
           LEFT JOIN app.inventory_movements m
             ON (m.tenant_id,m.lot_id)=(lot.tenant_id,lot.id)
           LEFT JOIN app.load_receipts r
             ON (r.tenant_id,r.load_id)=(lot.tenant_id,lot.source_load_id) AND r.is_current=true
           LEFT JOIN LATERAL (
             SELECT COALESCE(sum(a.quantity_kg-COALESCE(d.dispatched_kg,0)),0)::numeric(20,3) AS committed_kg
               FROM app.inventory_allocations a
               LEFT JOIN LATERAL (
                 SELECT COALESCE(sum(quantity_kg),0)::numeric(20,3) AS dispatched_kg
                   FROM app.inventory_dispatches
                  WHERE tenant_id=a.tenant_id AND allocation_id=a.id
               ) d ON true
              WHERE a.tenant_id=lot.tenant_id AND a.lot_id=lot.id AND a.status='ACTIVE'
           ) allocation_totals ON true
          WHERE lot.tenant_id=$1
          GROUP BY lot.id,lot.lot_code,lot.source_load_id,lot.contract_id,loc.code,loc.name,
                   lot.commodity,lot.status,lot.ownership_status,lot.risk_status,
                   lot.custody_status,lot.owner_counterparty_id,owner.legal_name,
                   lot.custodian_counterparty_id,custodian.legal_name,
                   r.moisture_pct,r.impurity_pct,r.damaged_pct,
                   l.vehicle_plate,lot.created_at,allocation_totals.committed_kg
          ORDER BY loc.code,lot.lot_code`,
        [tenantId],
      );
      const movements = await client.query<MovementRow>(
        `SELECT m.id,m.lot_id,lot.lot_code,m.source_load_id,m.source_receipt_id,
                m.allocation_id,m.dispatch_id,
                m.movement_type,m.quantity_delta_kg::text,m.occurred_at,m.created_at
           FROM app.inventory_movements m
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(m.tenant_id,m.lot_id)
          WHERE m.tenant_id=$1
          ORDER BY m.created_at DESC,m.id DESC`,
        [tenantId],
      );

      const physical = lots.rows.reduce(
        (total, row) => total.plus(row.quantity_kg),
        new Decimal(0),
      );
      const available = lots.rows
        .filter((row) => row.status === 'AVAILABLE')
        .reduce((total, row) => total.plus(row.available_kg), new Decimal(0));
      const committed = lots.rows.reduce(
        (total, row) => total.plus(row.committed_kg), new Decimal(0));
      const blocked = lots.rows.filter((row) => row.status !== 'AVAILABLE')
        .reduce((total, row) => total.plus(row.quantity_kg), new Decimal(0));
      const salesContracts = await client.query(salesContractsSql, [tenantId]);
      const allocations = await client.query(
        `SELECT a.id,a.sales_contract_id,a.lot_id,a.quantity_kg::text,a.status,a.created_at,
                sc.reference AS contract_reference,lot.lot_code,
                COALESCE(sum(d.quantity_kg),0)::text AS dispatched_kg
           FROM app.inventory_allocations a
           JOIN app.sales_contracts sc ON (sc.tenant_id,sc.id)=(a.tenant_id,a.sales_contract_id)
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(a.tenant_id,a.lot_id)
           LEFT JOIN app.inventory_dispatches d ON (d.tenant_id,d.allocation_id)=(a.tenant_id,a.id)
          WHERE a.tenant_id=$1
          GROUP BY a.id,a.sales_contract_id,a.lot_id,a.quantity_kg,a.status,a.created_at,sc.reference,lot.lot_code
          ORDER BY a.created_at DESC,a.id DESC`, [tenantId]);
      const dispatches = await client.query(
        `SELECT d.id,d.allocation_id,d.quantity_kg::text,d.dispatched_at,d.vehicle_plate,
                d.document_reference,d.notes,d.created_at,sc.reference AS contract_reference,lot.lot_code
           FROM app.inventory_dispatches d
           JOIN app.inventory_allocations a ON (a.tenant_id,a.id)=(d.tenant_id,d.allocation_id)
           JOIN app.sales_contracts sc ON (sc.tenant_id,sc.id)=(a.tenant_id,a.sales_contract_id)
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(a.tenant_id,a.lot_id)
          WHERE d.tenant_id=$1 ORDER BY d.created_at DESC,d.id DESC`, [tenantId]);
      const counterparties = await client.query(
        `SELECT id,legal_name FROM app.counterparties WHERE tenant_id=$1 ORDER BY legal_name,id`, [tenantId]);
      const locations = await client.query(
        `SELECT id,code,name,status FROM app.inventory_locations WHERE tenant_id=$1 ORDER BY code,id`, [tenantId]);
      const transfers = await client.query(
        `SELECT tr.id,tr.lot_id,lot.lot_code,tr.source_location_id,src.code AS source_location_code,
                tr.destination_location_id,dst.code AS destination_location_code,tr.status,
                tr.started_at,tr.completed_at,tr.cancelled_at,tr.reason,tr.created_at
           FROM app.inventory_transfers tr
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(tr.tenant_id,tr.lot_id)
           JOIN app.inventory_locations src ON (src.tenant_id,src.id)=(tr.tenant_id,tr.source_location_id)
           JOIN app.inventory_locations dst ON (dst.tenant_id,dst.id)=(tr.tenant_id,tr.destination_location_id)
          WHERE tr.tenant_id=$1 ORDER BY tr.created_at DESC,tr.id DESC`, [tenantId]);
      const lotEvents = await client.query(
        `SELECT e.id,e.lot_id,lot.lot_code,e.event_type,e.payload,e.reason,e.occurred_at,e.created_at
           FROM app.inventory_lot_events e
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(e.tenant_id,e.lot_id)
          WHERE e.tenant_id=$1 ORDER BY e.occurred_at DESC,e.id DESC`, [tenantId]);
      const counts = await client.query(
        `SELECT c.id,c.lot_id,lot.lot_code,c.system_quantity_kg::text,c.counted_quantity_kg::text,
                c.difference_kg::text,c.occurred_at,c.reason,c.created_at
           FROM app.inventory_counts c
           JOIN app.inventory_lots lot ON (lot.tenant_id,lot.id)=(c.tenant_id,c.lot_id)
          WHERE c.tenant_id=$1 ORDER BY c.occurred_at DESC,c.id DESC`, [tenantId]);
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
          committedWeightKg: committed.toFixed(3),
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
          owner: row.owner_counterparty_id ? {
            id: row.owner_counterparty_id, name: row.owner_counterparty_name,
          } : null,
          custodian: row.custodian_counterparty_id ? {
            id: row.custodian_counterparty_id, name: row.custodian_counterparty_name,
          } : null,
          quantityKg: row.quantity_kg,
          committedKg: row.committed_kg,
          availableKg: row.status === 'AVAILABLE' ? row.available_kg : '0.000',
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
          allocationId: row.allocation_id,
          dispatchId: row.dispatch_id,
          type: row.movement_type,
          quantityDeltaKg: row.quantity_delta_kg,
          occurredAt: row.occurred_at.toISOString(),
          recordedAt: row.created_at.toISOString(),
        })),
        salesContracts: salesContracts.rows,
        allocations: allocations.rows,
        dispatches: dispatches.rows,
        counterparties: counterparties.rows,
        locations: locations.rows,
        transfers: transfers.rows,
        lotEvents: lotEvents.rows,
        counts: counts.rows,
      };
    });
  }

  salesPortfolio(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const [contracts, counterparties] = await Promise.all([
        client.query(salesContractsSql, [tenantId]),
        client.query(`SELECT id,legal_name FROM app.counterparties WHERE tenant_id=$1 ORDER BY legal_name,id`, [tenantId]),
      ]);
      return { items: contracts.rows, counterparties: counterparties.rows };
    });
  }

  createSalesContract(tenantId: string, actorId: string, input: SalesContractInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const counterparty = await client.query<{ party_type: string }>(
        'SELECT party_type FROM app.counterparties WHERE tenant_id=$1 AND id=$2',
        [tenantId, input.counterpartyId],
      );
      if (counterparty.rowCount !== 1) throw new NotFoundException({ code: 'COUNTERPARTY_NOT_FOUND' });
      if (counterparty.rows[0]?.party_type === 'UNCLASSIFIED') {
        throw new UnprocessableEntityException({ code: 'COUNTERPARTY_PROFILE_REQUIRED' });
      }
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.sales_contracts
            (tenant_id,id,counterparty_id,reference,commodity,quantity_kg,sale_price_per_kg,
             destination_code,delivery_start,delivery_end,required_documents,payment_term_days,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [tenantId, id, input.counterpartyId, input.reference, input.commodity,
            new Decimal(input.quantityKg).toFixed(3), new Decimal(input.salePricePerKg).toFixed(6),
            input.destinationCode, input.deliveryStart, input.deliveryEnd, input.requiredDocuments,
            input.paymentTermDays, actorId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'SALES_CONTRACT_REFERENCE_EXISTS' });
        throw error;
      }
      await this.recordSalesContractVersion(client, tenantId, actorId, id);
      await this.record(client, tenantId, actorId, 'sales_contract.created', 'sales_contract', id, input);
      return { id, status: 'ACTIVE', ...input };
    });
  }

  updateSalesContract(tenantId: string, actorId: string, contractId: string, input: SalesContractInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const current = await client.query<{ status: string }>(
        `SELECT status FROM app.sales_contracts WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, contractId],
      );
      if (!current.rows[0]) throw new NotFoundException({ code: 'SALES_CONTRACT_NOT_FOUND' });
      if (current.rows[0].status !== 'ACTIVE') throw new ConflictException({ code: 'SALES_CONTRACT_NOT_ACTIVE' });
      const allocated = await client.query<{ allocated_kg: string }>(
        `SELECT COALESCE(sum(quantity_kg) FILTER (WHERE status<>'RELEASED'),0)::text AS allocated_kg
           FROM app.inventory_allocations WHERE tenant_id=$1 AND sales_contract_id=$2`,
        [tenantId, contractId]);
      if (new Decimal(input.quantityKg).lessThan(allocated.rows[0]!.allocated_kg)) {
        throw new UnprocessableEntityException({ code: 'SALES_CONTRACT_BELOW_ALLOCATED_BALANCE' });
      }
      const counterparty = await client.query<{ party_type: string }>(
        'SELECT party_type FROM app.counterparties WHERE tenant_id=$1 AND id=$2', [tenantId, input.counterpartyId]);
      if (counterparty.rowCount !== 1) throw new NotFoundException({ code: 'COUNTERPARTY_NOT_FOUND' });
      if (counterparty.rows[0]?.party_type === 'UNCLASSIFIED') {
        throw new UnprocessableEntityException({ code: 'COUNTERPARTY_PROFILE_REQUIRED' });
      }
      try {
        await client.query(
          `UPDATE app.sales_contracts SET counterparty_id=$3,reference=$4,commodity=$5,
                  quantity_kg=$6,sale_price_per_kg=$7,destination_code=$8,delivery_start=$9,
                  delivery_end=$10,required_documents=$11,payment_term_days=$12,updated_at=now()
            WHERE tenant_id=$1 AND id=$2`,
          [tenantId, contractId, input.counterpartyId, input.reference, input.commodity,
            new Decimal(input.quantityKg).toFixed(3), new Decimal(input.salePricePerKg).toFixed(6),
            input.destinationCode, input.deliveryStart, input.deliveryEnd, input.requiredDocuments,
            input.paymentTermDays],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'SALES_CONTRACT_REFERENCE_EXISTS' });
        throw error;
      }
      await this.recordSalesContractVersion(client, tenantId, actorId, contractId);
      await this.record(client, tenantId, actorId, 'sales_contract.updated', 'sales_contract', contractId, input);
      return { id: contractId, status: current.rows[0].status, ...input };
    });
  }

  salesContractVersions(tenantId: string, actorId: string, contractId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const contract = await client.query(
        'SELECT 1 FROM app.sales_contracts WHERE tenant_id=$1 AND id=$2', [tenantId, contractId]);
      if (contract.rowCount !== 1) throw new NotFoundException({ code: 'SALES_CONTRACT_NOT_FOUND' });
      const versions = await client.query(
        `SELECT version_number,terms,recorded_by,recorded_at
           FROM app.sales_contract_versions
          WHERE tenant_id=$1 AND sales_contract_id=$2
          ORDER BY version_number DESC`, [tenantId, contractId]);
      return { contractId, versions: versions.rows };
    });
  }

  private async recordSalesContractVersion(client: PoolClient, tenantId: string, actorId: string, contractId: string) {
    await client.query(
      `INSERT INTO app.sales_contract_versions
        (tenant_id,sales_contract_id,version_number,terms,recorded_by)
       SELECT sc.tenant_id,sc.id,
              COALESCE((SELECT max(v.version_number)+1 FROM app.sales_contract_versions v
                         WHERE v.tenant_id=sc.tenant_id AND v.sales_contract_id=sc.id),1),
              jsonb_build_object(
                'counterpartyId',sc.counterparty_id,
                'reference',sc.reference,
                'commodity',sc.commodity,
                'quantityKg',sc.quantity_kg::text,
                'salePricePerKg',sc.sale_price_per_kg::text,
                'destinationCode',sc.destination_code,
                'deliveryStart',sc.delivery_start::text,
                'deliveryEnd',sc.delivery_end::text,
                'requiredDocuments',sc.required_documents,
                'paymentTermDays',sc.payment_term_days,
                'status',sc.status),
              $3
         FROM app.sales_contracts sc
        WHERE sc.tenant_id=$1 AND sc.id=$2`, [tenantId, contractId, actorId]);
  }

  allocate(tenantId: string, actorId: string, input: AllocationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const lotBase = await client.query<{ commodity: string; status: string }>(
        `SELECT commodity,status FROM app.inventory_lots WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, input.lotId]);
      if (!lotBase.rows[0]) throw new NotFoundException({ code: 'INVENTORY_LOT_NOT_FOUND' });
      const lotBalance = await client.query<{ physical_kg: string; committed_kg: string }>(
        `SELECT COALESCE((SELECT sum(m.quantity_delta_kg) FROM app.inventory_movements m
                  WHERE m.tenant_id=$1 AND m.lot_id=$2),0)::text AS physical_kg,
                COALESCE((SELECT sum(a.quantity_kg-COALESCE((SELECT sum(d.quantity_kg)
                  FROM app.inventory_dispatches d WHERE d.tenant_id=a.tenant_id AND d.allocation_id=a.id),0))
                  FROM app.inventory_allocations a WHERE a.tenant_id=$1 AND a.lot_id=$2
                    AND a.status='ACTIVE'),0)::text AS committed_kg
        `,
        [tenantId, input.lotId],
      );
      if (lotBase.rows[0].status !== 'AVAILABLE') throw new ConflictException({ code: 'INVENTORY_LOT_NOT_AVAILABLE' });
      const contractBase = await client.query<{ commodity: string; status: string; quantity_kg: string }>(
        `SELECT commodity,status,quantity_kg::text FROM app.sales_contracts
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, input.salesContractId]);
      if (!contractBase.rows[0]) throw new NotFoundException({ code: 'SALES_CONTRACT_NOT_FOUND' });
      const contractAllocated = await client.query<{ allocated_kg: string }>(
        `SELECT COALESCE(sum(quantity_kg) FILTER (WHERE status<>'RELEASED'),0)::text AS allocated_kg
           FROM app.inventory_allocations WHERE tenant_id=$1 AND sales_contract_id=$2`,
        [tenantId, input.salesContractId]);
      if (contractBase.rows[0].status !== 'ACTIVE') throw new ConflictException({ code: 'SALES_CONTRACT_NOT_ACTIVE' });
      if (contractBase.rows[0].commodity !== lotBase.rows[0].commodity) {
        throw new UnprocessableEntityException({ code: 'ALLOCATION_COMMODITY_MISMATCH' });
      }
      const quantity = new Decimal(input.quantityKg);
      const available = new Decimal(lotBalance.rows[0]!.physical_kg).minus(lotBalance.rows[0]!.committed_kg);
      if (quantity.greaterThan(available)) {
        throw new UnprocessableEntityException({ code: 'ALLOCATION_EXCEEDS_LOT_AVAILABILITY', availableWeightKg: available.toFixed(3) });
      }
      const contractBalance = new Decimal(contractBase.rows[0].quantity_kg).minus(contractAllocated.rows[0]!.allocated_kg);
      if (quantity.greaterThan(contractBalance)) {
        throw new UnprocessableEntityException({ code: 'ALLOCATION_EXCEEDS_CONTRACT_BALANCE', availableWeightKg: contractBalance.toFixed(3) });
      }
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.inventory_allocations
          (tenant_id,id,sales_contract_id,lot_id,quantity_kg,created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, id, input.salesContractId, input.lotId, quantity.toFixed(3), actorId]);
      await this.record(client, tenantId, actorId, 'inventory.allocated', 'inventory_allocation', id, input);
      return { id, status: 'ACTIVE', ...input, quantityKg: quantity.toFixed(3) };
    });
  }

  releaseAllocation(tenantId: string, actorId: string, allocationId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const allocation = await client.query<{ status: string }>(
        `SELECT status FROM app.inventory_allocations WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, allocationId]);
      if (!allocation.rows[0]) throw new NotFoundException({ code: 'ALLOCATION_NOT_FOUND' });
      if (allocation.rows[0].status !== 'ACTIVE') throw new ConflictException({ code: 'ALLOCATION_NOT_ACTIVE' });
      const dispatched = await client.query<{ dispatched_kg: string }>(
        `SELECT COALESCE(sum(quantity_kg),0)::text AS dispatched_kg FROM app.inventory_dispatches
          WHERE tenant_id=$1 AND allocation_id=$2`, [tenantId, allocationId]);
      if (!new Decimal(dispatched.rows[0]!.dispatched_kg).isZero()) {
        throw new ConflictException({ code: 'ALLOCATION_WITH_DISPATCH_CANNOT_BE_RELEASED' });
      }
      await client.query(`UPDATE app.inventory_allocations SET status='RELEASED',released_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, allocationId]);
      await this.record(client, tenantId, actorId, 'inventory.allocation_released', 'inventory_allocation', allocationId, {});
      return { id: allocationId, status: 'RELEASED' };
    });
  }

  dispatch(tenantId: string, actorId: string, input: DispatchInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const allocation = await client.query<{
        status: string; quantity_kg: string; lot_id: string;
      }>(
        `SELECT status,quantity_kg::text,lot_id FROM app.inventory_allocations
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, input.allocationId]);
      if (!allocation.rows[0]) throw new NotFoundException({ code: 'ALLOCATION_NOT_FOUND' });
      await client.query(`SELECT 1 FROM app.inventory_lots WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, allocation.rows[0].lot_id]);
      const balances = await client.query<{ dispatched_kg: string; physical_kg: string }>(
        `SELECT COALESCE((SELECT sum(quantity_kg) FROM app.inventory_dispatches
                  WHERE tenant_id=$1 AND allocation_id=$2),0)::text AS dispatched_kg,
                COALESCE((SELECT sum(quantity_delta_kg) FROM app.inventory_movements
                  WHERE tenant_id=$1 AND lot_id=$3),0)::text AS physical_kg`,
        [tenantId, input.allocationId, allocation.rows[0].lot_id]);
      if (allocation.rows[0].status !== 'ACTIVE') throw new ConflictException({ code: 'ALLOCATION_NOT_ACTIVE' });
      const quantity = new Decimal(input.quantityKg);
      const remaining = new Decimal(allocation.rows[0].quantity_kg).minus(balances.rows[0]!.dispatched_kg);
      if (quantity.greaterThan(remaining)) {
        throw new UnprocessableEntityException({ code: 'DISPATCH_EXCEEDS_ALLOCATION_BALANCE', availableWeightKg: remaining.toFixed(3) });
      }
      if (quantity.greaterThan(balances.rows[0]!.physical_kg)) {
        throw new UnprocessableEntityException({ code: 'DISPATCH_EXCEEDS_PHYSICAL_BALANCE' });
      }
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.inventory_dispatches
          (tenant_id,id,allocation_id,quantity_kg,dispatched_at,vehicle_plate,document_reference,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, id, input.allocationId, quantity.toFixed(3), input.dispatchedAt,
          input.vehiclePlate, input.documentReference, input.notes, actorId]);
      await client.query(
        `INSERT INTO app.inventory_movements
          (tenant_id,id,lot_id,allocation_id,dispatch_id,movement_type,quantity_delta_kg,occurred_at,created_by)
         VALUES ($1,$2,$3,$4,$5,'DISPATCH',$6,$7,$8)`,
        [tenantId, randomUUID(), allocation.rows[0].lot_id, input.allocationId, id,
          quantity.negated().toFixed(3), input.dispatchedAt, actorId]);
      if (quantity.equals(remaining)) {
        await client.query(`UPDATE app.inventory_allocations SET status='FULFILLED'
          WHERE tenant_id=$1 AND id=$2`, [tenantId, input.allocationId]);
      }
      const projection = await this.finance.projectSalesDispatch(client, {
        tenantId, actorId, dispatchId: id,
      });
      await this.record(client, tenantId, actorId, 'inventory.dispatched', 'inventory_dispatch', id, input);
      return {
        id, allocationId: input.allocationId, quantityKg: quantity.toFixed(3), status: 'CONFIRMED',
        ...projection,
      };
    });
  }

  createLocation(tenantId: string, actorId: string, input: InventoryLocationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.inventory_locations (tenant_id,id,code,name,created_by)
           VALUES ($1,$2,$3,$4,$5)`, [tenantId, id, input.code, input.name, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'INVENTORY_LOCATION_CODE_EXISTS' });
        throw error;
      }
      await this.record(client, tenantId, actorId, 'inventory.location_created', 'inventory_location', id, input);
      return { id, status: 'ACTIVE', ...input };
    });
  }

  classifyLot(tenantId: string, actorId: string, lotId: string, input: LotClassificationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const lot = await client.query(
        `SELECT ownership_status,risk_status,custody_status,owner_counterparty_id,custodian_counterparty_id
           FROM app.inventory_lots WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, lotId]);
      if (!lot.rows[0]) throw new NotFoundException({ code: 'INVENTORY_LOT_NOT_FOUND' });
      for (const counterpartyId of [input.ownerCounterpartyId, input.custodianCounterpartyId].filter(Boolean)) {
        const exists = await client.query(
          `SELECT 1 FROM app.counterparties WHERE tenant_id=$1 AND id=$2`, [tenantId, counterpartyId]);
        if (!exists.rows[0]) throw new NotFoundException({ code: 'COUNTERPARTY_NOT_FOUND' });
      }
      if (input.custodyStatus === 'IN_TRANSIT') {
        const activeTransfer = await client.query(
          `SELECT 1 FROM app.inventory_transfers WHERE tenant_id=$1 AND lot_id=$2 AND status='IN_TRANSIT'`,
          [tenantId, lotId]);
        if (!activeTransfer.rows[0]) throw new ConflictException({ code: 'CUSTODY_TRANSIT_REQUIRES_ACTIVE_TRANSFER' });
      }
      await client.query(
        `UPDATE app.inventory_lots SET ownership_status=$3,risk_status=$4,custody_status=$5,
                owner_counterparty_id=$6,custodian_counterparty_id=$7,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [tenantId, lotId, input.ownershipStatus, input.riskStatus, input.custodyStatus,
          input.ownerCounterpartyId, input.custodianCounterpartyId]);
      await this.recordLotEvent(client, tenantId, actorId, lotId, 'CLASSIFICATION_CHANGED', input, input.reason,
        new Date(input.occurredAt));
      await this.record(client, tenantId, actorId, 'inventory.lot_classified', 'inventory_lot', lotId, input);
      return { id: lotId, ...input };
    });
  }

  startTransfer(tenantId: string, actorId: string, lotId: string, input: StartTransferInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const lot = await client.query<{ location_id: string; custody_status: string }>(
        `SELECT location_id,custody_status FROM app.inventory_lots
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, lotId]);
      if (!lot.rows[0]) throw new NotFoundException({ code: 'INVENTORY_LOT_NOT_FOUND' });
      if (lot.rows[0].custody_status !== 'IN_STORAGE') {
        throw new ConflictException({ code: 'INVENTORY_LOT_NOT_IN_STORAGE' });
      }
      if (lot.rows[0].location_id === input.destinationLocationId) {
        throw new UnprocessableEntityException({ code: 'TRANSFER_DESTINATION_EQUALS_SOURCE' });
      }
      const destination = await client.query(
        `SELECT 1 FROM app.inventory_locations WHERE tenant_id=$1 AND id=$2 AND status='ACTIVE'`,
        [tenantId, input.destinationLocationId]);
      if (!destination.rows[0]) throw new NotFoundException({ code: 'INVENTORY_DESTINATION_NOT_FOUND' });
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.inventory_transfers
          (tenant_id,id,lot_id,source_location_id,destination_location_id,started_at,reason,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, id, lotId, lot.rows[0].location_id, input.destinationLocationId,
          input.startedAt, input.reason, actorId]);
      await client.query(`UPDATE app.inventory_lots SET custody_status='IN_TRANSIT',updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, lotId]);
      await this.recordLotEvent(client, tenantId, actorId, lotId, 'TRANSFER_STARTED', {
        transferId: id, sourceLocationId: lot.rows[0].location_id,
        destinationLocationId: input.destinationLocationId,
      }, input.reason, new Date(input.startedAt));
      await this.record(client, tenantId, actorId, 'inventory.transfer_started', 'inventory_transfer', id, input);
      return { id, lotId, sourceLocationId: lot.rows[0].location_id,
        destinationLocationId: input.destinationLocationId, status: 'IN_TRANSIT', startedAt: input.startedAt };
    });
  }

  completeTransfer(tenantId: string, actorId: string, transferId: string, input: CompleteTransferInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      const transfer = await client.query<{
        lot_id: string; destination_location_id: string; status: string; started_at: Date;
      }>(`SELECT lot_id,destination_location_id,status,started_at FROM app.inventory_transfers
           WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, transferId]);
      if (!transfer.rows[0]) throw new NotFoundException({ code: 'INVENTORY_TRANSFER_NOT_FOUND' });
      if (transfer.rows[0].status !== 'IN_TRANSIT') {
        throw new ConflictException({ code: 'INVENTORY_TRANSFER_NOT_ACTIVE' });
      }
      if (new Date(input.completedAt) < transfer.rows[0].started_at) {
        throw new UnprocessableEntityException({ code: 'TRANSFER_COMPLETION_PRECEDES_START' });
      }
      await client.query(`SELECT 1 FROM app.inventory_lots WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, transfer.rows[0].lot_id]);
      await client.query(
        `UPDATE app.inventory_transfers SET status='COMPLETED',completed_at=$3
          WHERE tenant_id=$1 AND id=$2`, [tenantId, transferId, input.completedAt]);
      await client.query(
        `UPDATE app.inventory_lots SET location_id=$3,custody_status='IN_STORAGE',updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [tenantId, transfer.rows[0].lot_id, transfer.rows[0].destination_location_id]);
      await this.recordLotEvent(client, tenantId, actorId, transfer.rows[0].lot_id, 'TRANSFER_COMPLETED', {
        transferId, destinationLocationId: transfer.rows[0].destination_location_id,
      }, input.reason, new Date(input.completedAt));
      await this.record(client, tenantId, actorId, 'inventory.transfer_completed', 'inventory_transfer', transferId, input);
      return { id: transferId, lotId: transfer.rows[0].lot_id, status: 'COMPLETED',
        completedAt: input.completedAt };
    });
  }

  recordLoss(tenantId: string, actorId: string, lotId: string, input: LossInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      await this.lockLot(client, tenantId, lotId);
      const balances = await this.lotBalances(client, tenantId, lotId);
      const quantity = new Decimal(input.quantityKg);
      const resulting = new Decimal(balances.physicalKg).minus(quantity);
      if (resulting.isNegative()) throw new UnprocessableEntityException({ code: 'LOSS_EXCEEDS_PHYSICAL_BALANCE' });
      if (resulting.lessThan(balances.committedKg)) {
        throw new UnprocessableEntityException({ code: 'LOSS_WOULD_BREAK_ACTIVE_ALLOCATIONS' });
      }
      const eventId = await this.recordLotEvent(client, tenantId, actorId, lotId, 'LOSS_RECORDED', {
        quantityKg: quantity.toFixed(3), previousQuantityKg: balances.physicalKg,
        resultingQuantityKg: resulting.toFixed(3),
      }, input.reason, new Date(input.occurredAt));
      await client.query(
        `INSERT INTO app.inventory_movements
          (tenant_id,id,lot_id,lot_event_id,movement_type,quantity_delta_kg,occurred_at,created_by)
         VALUES ($1,$2,$3,$4,'LOSS',$5,$6,$7)`,
        [tenantId, randomUUID(), lotId, eventId, quantity.negated().toFixed(3), input.occurredAt, actorId]);
      await this.record(client, tenantId, actorId, 'inventory.loss_recorded', 'inventory_lot', lotId, input);
      return { lotId, quantityKg: quantity.toFixed(3), resultingQuantityKg: resulting.toFixed(3) };
    });
  }

  reconcileCount(tenantId: string, actorId: string, lotId: string, input: InventoryCountInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'OPERATIONS_EDIT');
      await this.lockLot(client, tenantId, lotId);
      const balances = await this.lotBalances(client, tenantId, lotId);
      const counted = new Decimal(input.countedQuantityKg);
      if (counted.lessThan(balances.committedKg)) {
        throw new UnprocessableEntityException({ code: 'COUNT_BELOW_ACTIVE_ALLOCATIONS' });
      }
      const difference = counted.minus(balances.physicalKg);
      const countId = randomUUID();
      await client.query(
        `INSERT INTO app.inventory_counts
          (tenant_id,id,lot_id,system_quantity_kg,counted_quantity_kg,occurred_at,reason,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, countId, lotId, balances.physicalKg, counted.toFixed(3), input.occurredAt, input.reason, actorId]);
      const eventId = await this.recordLotEvent(client, tenantId, actorId, lotId, 'COUNT_RECONCILED', {
        countId, systemQuantityKg: balances.physicalKg, countedQuantityKg: counted.toFixed(3),
        differenceKg: difference.toFixed(3),
      }, input.reason, new Date(input.occurredAt));
      if (!difference.isZero()) {
        await client.query(
          `INSERT INTO app.inventory_movements
            (tenant_id,id,lot_id,lot_event_id,movement_type,quantity_delta_kg,occurred_at,created_by)
           VALUES ($1,$2,$3,$4,'COUNT_ADJUSTMENT',$5,$6,$7)`,
          [tenantId, randomUUID(), lotId, eventId, difference.toFixed(3), input.occurredAt, actorId]);
      }
      await this.record(client, tenantId, actorId, 'inventory.count_reconciled', 'inventory_lot', lotId, input);
      return { id: countId, lotId, systemQuantityKg: balances.physicalKg,
        countedQuantityKg: counted.toFixed(3), differenceKg: difference.toFixed(3) };
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

  private async lockLot(client: PoolClient, tenantId: string, lotId: string) {
    const lot = await client.query(
      `SELECT 1 FROM app.inventory_lots WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, lotId]);
    if (!lot.rows[0]) throw new NotFoundException({ code: 'INVENTORY_LOT_NOT_FOUND' });
  }

  private async lotBalances(client: PoolClient, tenantId: string, lotId: string) {
    const result = await client.query<{ physical_kg: string; committed_kg: string }>(
      `SELECT COALESCE((SELECT sum(m.quantity_delta_kg) FROM app.inventory_movements m
                 WHERE m.tenant_id=$1 AND m.lot_id=$2),0)::text AS physical_kg,
              COALESCE((SELECT sum(a.quantity_kg-COALESCE((SELECT sum(d.quantity_kg)
                 FROM app.inventory_dispatches d WHERE d.tenant_id=a.tenant_id AND d.allocation_id=a.id),0))
                 FROM app.inventory_allocations a WHERE a.tenant_id=$1 AND a.lot_id=$2
                   AND a.status='ACTIVE'),0)::text AS committed_kg`, [tenantId, lotId]);
    return {
      physicalKg: new Decimal(result.rows[0]!.physical_kg).toFixed(3),
      committedKg: new Decimal(result.rows[0]!.committed_kg).toFixed(3),
    };
  }

  private async recordLotEvent(client: PoolClient, tenantId: string, actorId: string, lotId: string,
    eventType: string, payload: unknown, reason: string, occurredAt: Date) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.inventory_lot_events
        (tenant_id,id,lot_id,event_type,payload,reason,occurred_at,created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [tenantId, id, lotId, eventType, JSON.stringify(payload), reason, occurredAt, actorId]);
    return id;
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true`,
      [tenantId, actorId],
    );
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query<{ capabilities: string[] }>(
      `SELECT capabilities FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true`,
      [tenantId, actorId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
    if (!result.rows[0].capabilities.includes(capability)) {
      throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
    }
  }

  private async record(client: PoolClient, tenantId: string, actorId: string,
    eventType: string, aggregateType: string, aggregateId: string, payload: unknown) {
    const id = randomUUID();
    const body = JSON.stringify(payload);
    await client.query(
      `INSERT INTO app.audit_events
        (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tenantId, id, actorId, eventType, aggregateType, aggregateId, body]);
    await client.query(
      `INSERT INTO app.outbox_events
        (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [tenantId, id, eventType, aggregateType, aggregateId, body]);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
