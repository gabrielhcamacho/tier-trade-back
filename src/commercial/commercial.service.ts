import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { calculateProjectedMargin, decideSubmission } from '../domain/pricing.js';
import type {
  AttachContractObligationEvidenceInput,
  CloseCommercialDemandInput,
  CreateCommercialDemandInput,
  CreateNegotiationEntryInput,
  CancelOfferInput,
  CreateContractObligationInput,
  CreateCounterpartyInput,
  CreateOfferInput,
  MarginPolicyInput,
  PurchaseContractTermsInput,
  UpdateContractObligationInput,
  UpdateCounterpartyProfileInput,
  UpdateCommercialDemandInput,
} from './commercial.schemas.js';

interface MarginPolicyRow {
  id: string;
  version: number;
  auto_approval_margin_per_sc: string;
  absolute_floor_margin_per_sc: string;
}

@Injectable()
export class CommercialService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async listCounterparties(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<{ id: string; legal_name: string; tax_id: string; party_type: string }>(
        `SELECT id,legal_name,tax_id,party_type FROM app.counterparties WHERE tenant_id=$1 ORDER BY legal_name,id`, [tenantId]);
      return result.rows.map((row) => ({ id: row.id, legalName: row.legal_name,
        taxIdLength: row.tax_id.length, taxIdLast4: row.tax_id.slice(-4), partyType: row.party_type }));
    });
  }

  async createCounterparty(tenantId: string, actorId: string, input: CreateCounterpartyInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const counterpartyId = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id,party_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [tenantId, counterpartyId, input.legalName, input.taxId, input.partyType],
        );
      } catch (cause) {
        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
          throw new ConflictException({ code: 'COUNTERPARTY_TAX_ID_ALREADY_EXISTS' });
        }
        throw cause;
      }
      await this.record(client, tenantId, actorId, 'counterparty.created', 'counterparty', counterpartyId,
        { legalName: input.legalName, partyType: input.partyType });
      return { id: counterpartyId, legalName: input.legalName, taxId: input.taxId,
        partyType: input.partyType };
    });
  }

  async updateCounterpartyProfile(tenantId: string, actorId: string, counterpartyId: string,
    input: UpdateCounterpartyProfileInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const counterparty = await this.db.one<{ legal_name: string; tax_id: string; party_type: string }>(client,
        `SELECT legal_name,tax_id,party_type FROM app.counterparties
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, counterpartyId]);
      const expectedLength = input.partyType === 'PERSON' ? 11 : 14;
      if (counterparty.tax_id.length !== expectedLength) {
        throw new UnprocessableEntityException({ code: 'PARTY_TYPE_TAX_ID_MISMATCH' });
      }
      if (counterparty.party_type !== input.partyType) {
        await client.query(
          `UPDATE app.counterparties SET party_type=$3 WHERE tenant_id=$1 AND id=$2`,
          [tenantId, counterpartyId, input.partyType]);
        await this.record(client, tenantId, actorId, 'counterparty.profile_changed', 'counterparty', counterpartyId,
          { previousPartyType: counterparty.party_type, partyType: input.partyType });
      }
      return { id: counterpartyId, legalName: counterparty.legal_name,
        taxId: counterparty.tax_id, partyType: input.partyType };
    });
  }

  async listDemands(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const [demands, counterparties] = await Promise.all([
        client.query(
          `SELECT d.id,d.counterparty_id,cp.legal_name AS counterparty_name,d.direction,d.commodity,
                  d.unit,d.quantity_sc::text,d.delivery_start::text,d.delivery_end::text,
                  d.indicative_price_per_sc::text,d.description,d.status,d.version,
                  d.created_at::text,d.updated_at::text,d.close_reason,
                  (SELECT count(*)::integer FROM app.commercial_negotiation_entries n
                    WHERE n.tenant_id=d.tenant_id AND n.demand_id=d.id) AS negotiation_count
             FROM app.commercial_demands d
             JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(d.tenant_id,d.counterparty_id)
            WHERE d.tenant_id=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT 501`, [tenantId]),
        client.query('SELECT id,legal_name,party_type FROM app.counterparties WHERE tenant_id=$1 ORDER BY legal_name,id', [tenantId]),
      ]);
      return { items: demands.rows.slice(0, 500), hasMore: demands.rows.length > 500,
        counterparties: counterparties.rows };
    });
  }

  async demandDetail(tenantId: string, actorId: string, demandId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const demand = await client.query(
        `SELECT d.id,d.counterparty_id,cp.legal_name AS counterparty_name,d.direction,d.commodity,
                d.unit,d.quantity_sc::text,d.delivery_start::text,d.delivery_end::text,
                d.indicative_price_per_sc::text,d.description,d.status,d.version,
                d.created_at::text,d.updated_at::text,d.close_reason,d.closed_at::text
           FROM app.commercial_demands d
           JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(d.tenant_id,d.counterparty_id)
          WHERE d.tenant_id=$1 AND d.id=$2`, [tenantId, demandId]);
      if (!demand.rows[0]) throw new NotFoundException({ code: 'COMMERCIAL_DEMAND_NOT_FOUND' });
      const entries = await client.query(
        `SELECT id,note,indicative_price_per_sc::text,created_by,created_at::text
           FROM app.commercial_negotiation_entries
          WHERE tenant_id=$1 AND demand_id=$2 ORDER BY created_at DESC,id DESC`, [tenantId, demandId]);
      return { demand: demand.rows[0], negotiations: entries.rows };
    });
  }

  async createDemand(tenantId: string, actorId: string, input: CreateCommercialDemandInput) {
    this.assertDemandWindow(input);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      await this.assertClassifiedCounterparty(client, tenantId, input.counterpartyId);
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.commercial_demands
          (tenant_id,id,counterparty_id,direction,commodity,unit,quantity_sc,delivery_start,
           delivery_end,indicative_price_per_sc,description,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [tenantId, id, input.counterpartyId, input.direction, input.commodity, input.unit,
          input.quantitySc, input.deliveryStart, input.deliveryEnd, input.indicativePricePerSc,
          input.description, actorId],
      );
      await this.record(client, tenantId, actorId, 'commercial.demand.created', 'commercial_demand', id,
        { direction: input.direction, commodity: input.commodity, counterpartyId: input.counterpartyId });
      return { id, status: 'OPEN', version: 1 };
    });
  }

  async updateDemand(tenantId: string, actorId: string, demandId: string, input: UpdateCommercialDemandInput) {
    this.assertDemandWindow(input);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const current = await client.query(
        'SELECT * FROM app.commercial_demands WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, demandId]);
      if (!current.rows[0]) throw new NotFoundException({ code: 'COMMERCIAL_DEMAND_NOT_FOUND' });
      if (current.rows[0].status !== 'OPEN') throw new ConflictException({ code: 'COMMERCIAL_DEMAND_CLOSED' });
      if (current.rows[0].version !== input.expectedVersion) {
        throw new ConflictException({ code: 'COMMERCIAL_DEMAND_VERSION_CONFLICT' });
      }
      await this.assertClassifiedCounterparty(client, tenantId, input.counterpartyId);
      const result = await client.query<{ version: number }>(
        `UPDATE app.commercial_demands
            SET counterparty_id=$3,direction=$4,commodity=$5,unit=$6,quantity_sc=$7,
                delivery_start=$8,delivery_end=$9,indicative_price_per_sc=$10,
                description=$11,version=version+1,updated_at=now()
          WHERE tenant_id=$1 AND id=$2 RETURNING version`,
        [tenantId, demandId, input.counterpartyId, input.direction, input.commodity,
          input.unit, input.quantitySc, input.deliveryStart, input.deliveryEnd,
          input.indicativePricePerSc, input.description],
      );
      await this.record(client, tenantId, actorId, 'commercial.demand.updated', 'commercial_demand', demandId,
        { before: current.rows[0], after: input, version: result.rows[0]?.version });
      return { id: demandId, status: 'OPEN', version: result.rows[0]?.version };
    });
  }

  async closeDemand(tenantId: string, actorId: string, demandId: string, input: CloseCommercialDemandInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const result = await client.query<{ version: number }>(
        `UPDATE app.commercial_demands
            SET status='CLOSED',close_reason=$3,closed_by=$4,closed_at=now(),
                updated_at=now(),version=version+1
          WHERE tenant_id=$1 AND id=$2 AND status='OPEN' RETURNING version`,
        [tenantId, demandId, input.reason, actorId],
      );
      if (!result.rows[0]) {
        const exists = await client.query('SELECT status FROM app.commercial_demands WHERE tenant_id=$1 AND id=$2',
          [tenantId, demandId]);
        if (!exists.rows[0]) throw new NotFoundException({ code: 'COMMERCIAL_DEMAND_NOT_FOUND' });
        throw new ConflictException({ code: 'COMMERCIAL_DEMAND_CLOSED' });
      }
      await this.record(client, tenantId, actorId, 'commercial.demand.closed', 'commercial_demand', demandId,
        { reason: input.reason, version: result.rows[0].version });
      return { id: demandId, status: 'CLOSED', version: result.rows[0].version };
    });
  }

  async addNegotiationEntry(tenantId: string, actorId: string, demandId: string,
    input: CreateNegotiationEntryInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const demand = await client.query<{ status: string }>(
        'SELECT status FROM app.commercial_demands WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, demandId]);
      if (!demand.rows[0]) throw new NotFoundException({ code: 'COMMERCIAL_DEMAND_NOT_FOUND' });
      if (demand.rows[0].status !== 'OPEN') throw new ConflictException({ code: 'COMMERCIAL_DEMAND_CLOSED' });
      const id = randomUUID();
      const result = await client.query(
        `INSERT INTO app.commercial_negotiation_entries
          (tenant_id,id,demand_id,note,indicative_price_per_sc,created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id,note,indicative_price_per_sc::text,created_by,created_at::text`,
        [tenantId, id, demandId, input.note, input.indicativePricePerSc, actorId],
      );
      await this.record(client, tenantId, actorId, 'commercial.negotiation.recorded', 'commercial_demand', demandId,
        { entryId: id, ...input });
      return result.rows[0];
    });
  }

  async createOffer(tenantId: string, actorId: string, input: CreateOfferInput) {
    this.assertDeliveryWindow(input);
    const pricing = calculateProjectedMargin(input);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      await this.assertClassifiedCounterparty(client, tenantId, input.counterpartyId);
      const policy = await this.db.one<MarginPolicyRow>(
        client,
        `SELECT id, version, auto_approval_margin_per_sc, absolute_floor_margin_per_sc
           FROM app.margin_policies
          WHERE tenant_id = $1 AND commodity = $2 AND active = true`,
        [tenantId, input.commodity],
      );
      const offerId = randomUUID();
      const scenarioId = randomUUID();
      await client.query(
        `INSERT INTO app.offers
          (tenant_id, id, counterparty_id, commodity, unit, quantity_sc, delivery_start, delivery_end, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9)`,
        [tenantId, offerId, input.counterpartyId, input.commodity, input.unit, input.quantitySc,
          input.deliveryStart, input.deliveryEnd, actorId],
      );
      await client.query(
        `INSERT INTO app.pricing_scenarios
          (tenant_id, id, offer_id, policy_id, policy_version, purchase_price_per_sc,
           sale_reference_per_sc, total_costs_per_sc, projected_margin_per_sc, cost_breakdown, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [tenantId, scenarioId, offerId, policy.id, policy.version, pricing.purchasePricePerSc,
          pricing.saleReferencePerSc, pricing.totalCostsPerSc, pricing.projectedMarginPerSc,
          JSON.stringify(input.costs), actorId],
      );
      await this.record(client, tenantId, actorId, 'offer.created', 'offer', offerId, { scenarioId });
      return { offerId, scenarioId, status: 'DRAFT', pricing, policyVersion: policy.version };
    });
  }

  async listOffers(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await this.db.one<{ legal_name: string; is_demo: boolean }>(client,
        'SELECT legal_name,is_demo FROM app.tenants WHERE id=$1', [tenantId]);
      const result = await client.query(
        `SELECT o.id,o.status,o.commodity,o.unit,o.quantity_sc,
                o.delivery_start::text,o.delivery_end::text,o.created_at::text,
                cp.legal_name AS counterparty_name,
                s.purchase_price_per_sc,s.projected_margin_per_sc
           FROM app.offers o
           JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
           JOIN app.pricing_scenarios s
             ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
          WHERE o.tenant_id=$1
          ORDER BY o.created_at DESC,o.id DESC`, [tenantId]);
      return { tenant: { legalName: tenant.legal_name, isDemo: tenant.is_demo }, items: result.rows };
    });
  }

  async offerDetail(tenantId: string, actorId: string, offerId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<{
        id: string; status: string; counterparty_id: string; commodity: string; unit: string;
        quantity_sc: string; delivery_start: string; delivery_end: string;
        purchase_price_per_sc: string; sale_reference_per_sc: string;
        total_costs_per_sc: string; projected_margin_per_sc: string;
        cost_breakdown: Array<{ code: string; amountPerSc: string }>;
        scenario_version: number; policy_version: number;
        approval_id: string | null; approval_status: string | null; contract_id: string | null;
      }>(
        `SELECT o.id,o.status,o.counterparty_id,o.commodity,o.unit,o.quantity_sc,
                o.delivery_start::text,o.delivery_end::text,
                s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,
                s.projected_margin_per_sc,s.cost_breakdown,s.version AS scenario_version,
                s.policy_version,
                a.id AS approval_id,a.status AS approval_status,c.id AS contract_id
           FROM app.offers o
           JOIN app.pricing_scenarios s
             ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
           LEFT JOIN LATERAL (
             SELECT id,status FROM app.approvals
              WHERE tenant_id=o.tenant_id AND offer_id=o.id
              ORDER BY requested_at DESC,id DESC LIMIT 1
           ) a ON true
           LEFT JOIN app.contracts c ON (c.tenant_id,c.offer_id)=(o.tenant_id,o.id)
          WHERE o.tenant_id=$1 AND o.id=$2`, [tenantId, offerId]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
      return {
        offerId: row.id, status: row.status, counterpartyId: row.counterparty_id,
        commodity: row.commodity, unit: row.unit, quantitySc: row.quantity_sc,
        deliveryStart: row.delivery_start, deliveryEnd: row.delivery_end,
        purchasePricePerSc: row.purchase_price_per_sc,
        saleReferencePerSc: row.sale_reference_per_sc, costs: row.cost_breakdown,
        pricing: { totalCostsPerSc: row.total_costs_per_sc,
          projectedMarginPerSc: row.projected_margin_per_sc },
        scenarioVersion: row.scenario_version, policyVersion: row.policy_version,
        approval: row.approval_id ? { id: row.approval_id, status: row.approval_status } : null,
        contractId: row.contract_id,
      };
    });
  }

  async updateOffer(tenantId: string, actorId: string, offerId: string, input: CreateOfferInput) {
    this.assertDeliveryWindow(input);
    const pricing = calculateProjectedMargin(input);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      await this.assertClassifiedCounterparty(client, tenantId, input.counterpartyId);
      const offer = await this.db.one<{ status: string; created_by: string }>(client,
        'SELECT status,created_by FROM app.offers WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, offerId]);
      if (offer.status !== 'DRAFT') throw new ConflictException({ code: 'ONLY_DRAFT_OFFERS_CAN_BE_EDITED' });
      const policy = await this.activeMarginPolicy(client, tenantId, input.commodity);
      const previous = await this.db.one<{ id: string; version: number }>(client,
        `SELECT id,version FROM app.pricing_scenarios
          WHERE tenant_id=$1 AND offer_id=$2 AND is_current=true FOR UPDATE`, [tenantId, offerId]);
      const scenarioId = randomUUID();
      const scenarioVersion = previous.version + 1;
      await client.query(
        `UPDATE app.offers SET counterparty_id=$3,commodity=$4,unit=$5,quantity_sc=$6,
           delivery_start=$7,delivery_end=$8,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, offerId, input.counterpartyId, input.commodity, input.unit, input.quantitySc,
          input.deliveryStart, input.deliveryEnd],
      );
      await client.query(
        `UPDATE app.pricing_scenarios SET is_current=false
          WHERE tenant_id=$1 AND offer_id=$2 AND is_current=true`, [tenantId, offerId]);
      await client.query(
        `INSERT INTO app.pricing_scenarios
          (tenant_id,id,offer_id,policy_id,policy_version,purchase_price_per_sc,sale_reference_per_sc,
           total_costs_per_sc,projected_margin_per_sc,cost_breakdown,created_by,version,is_current)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,true)`,
        [tenantId, scenarioId, offerId, policy.id, policy.version, pricing.purchasePricePerSc,
          pricing.saleReferencePerSc, pricing.totalCostsPerSc, pricing.projectedMarginPerSc,
          JSON.stringify(input.costs), actorId, scenarioVersion],
      );
      await this.record(client, tenantId, actorId, 'offer.repriced', 'offer', offerId,
        { scenarioId, replacedScenarioId: previous.id, scenarioVersion });
      return { offerId, scenarioId, scenarioVersion, status: 'DRAFT', pricing, policyVersion: policy.version };
    });
  }

  async cancelOffer(tenantId: string, actorId: string, offerId: string, input: CancelOfferInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const offer = await this.db.one<{ status: string; created_by: string }>(client,
        'SELECT status,created_by FROM app.offers WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, offerId]);
      if (offer.status === 'CONVERTED') throw new ConflictException({ code: 'ACTIVE_CONTRACT_PREVENTS_CANCELLATION' });
      if (offer.status === 'CANCELLED') throw new ConflictException({ code: 'OFFER_ALREADY_CANCELLED' });
      if (offer.status !== 'DRAFT' || offer.created_by !== actorId) {
        await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_CANCEL');
      }
      await client.query(
        `UPDATE app.offers SET status='CANCELLED',cancelled_at=now(),cancelled_by=$3,
           cancellation_reason=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, offerId, actorId, input.reason],
      );
      await client.query(
        `UPDATE app.approvals SET status='CANCELLED',decided_by=$3,decided_at=now()
          WHERE tenant_id=$1 AND offer_id=$2 AND status='PENDING'`, [tenantId, offerId, actorId]);
      await this.record(client, tenantId, actorId, 'offer.cancelled', 'offer', offerId,
        { previousStatus: offer.status, reason: input.reason });
      return { offerId, status: 'CANCELLED', reason: input.reason };
    });
  }

  async currentMarginPolicy(tenantId: string, actorId: string, commodity: 'MILHO' | 'SOJA') {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query<MarginPolicyRow>(
        `SELECT id,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc
           FROM app.margin_policies WHERE tenant_id=$1 AND commodity=$2 AND active=true`,
        [tenantId, commodity],
      );
      const policy = result.rows[0];
      if (!policy) return null;
      return {
        id: policy.id,
        commodity,
        version: policy.version,
        autoApprovalMarginPerSc: policy.auto_approval_margin_per_sc,
        absoluteFloorMarginPerSc: policy.absolute_floor_margin_per_sc,
      };
    });
  }

  async configureMarginPolicy(tenantId: string, actorId: string, input: MarginPolicyInput) {
    if (new Decimal(input.autoApprovalMarginPerSc).lessThan(input.absoluteFloorMarginPerSc)) {
      throw new UnprocessableEntityException({ code: 'AUTO_APPROVAL_BELOW_ABSOLUTE_FLOOR' });
    }
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'MARGIN_POLICY_MANAGE');
      const current = await client.query<MarginPolicyRow>(
        `SELECT id,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc
           FROM app.margin_policies WHERE tenant_id=$1 AND commodity=$2 AND active=true FOR UPDATE`,
        [tenantId, input.commodity],
      );
      const version = (current.rows[0]?.version ?? 0) + 1;
      const policyId = randomUUID();
      await client.query(
        'UPDATE app.margin_policies SET active=false WHERE tenant_id=$1 AND commodity=$2 AND active=true',
        [tenantId, input.commodity],
      );
      await client.query(
        `INSERT INTO app.margin_policies
          (tenant_id,id,commodity,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc,active)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [tenantId, policyId, input.commodity, version, input.autoApprovalMarginPerSc,
          input.absoluteFloorMarginPerSc],
      );
      await this.record(client, tenantId, actorId, 'margin_policy.changed', 'margin_policy', policyId,
        { commodity: input.commodity, version, replacedPolicyId: current.rows[0]?.id ?? null });
      return { policyId, commodity: input.commodity, version,
        autoApprovalMarginPerSc: input.autoApprovalMarginPerSc,
        absoluteFloorMarginPerSc: input.absoluteFloorMarginPerSc };
    });
  }

  async submitOffer(tenantId: string, actorId: string, offerId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const row = await this.db.one<MarginPolicyRow & { status: string; projected_margin_per_sc: string }>(
        client,
        `SELECT o.status, s.projected_margin_per_sc, p.id, p.version,
                p.auto_approval_margin_per_sc, p.absolute_floor_margin_per_sc
           FROM app.offers o
           JOIN app.pricing_scenarios s ON (s.tenant_id, s.offer_id) = (o.tenant_id, o.id) AND s.is_current=true
           JOIN app.margin_policies p ON (p.tenant_id, p.id) = (s.tenant_id, s.policy_id)
          WHERE o.tenant_id=$1 AND o.id=$2`,
        [tenantId, offerId],
      );
      if (row.status !== 'DRAFT') throw new ConflictException({ code: 'OFFER_NOT_DRAFT' });
      const decision = decideSubmission(row.projected_margin_per_sc, row.auto_approval_margin_per_sc,
        row.absolute_floor_margin_per_sc);
      if (decision.kind === 'BLOCKED_BELOW_FLOOR') {
        throw new UnprocessableEntityException({ code: 'MARGIN_BELOW_ABSOLUTE_FLOOR' });
      }
      const status = decision.kind === 'AUTO_APPROVED' ? 'APPROVED' : 'IN_APPROVAL';
      await client.query('UPDATE app.offers SET status=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2',
        [tenantId, offerId, status]);
      let approvalId: string | undefined;
      if (status === 'IN_APPROVAL') {
        approvalId = randomUUID();
        await client.query(
          `INSERT INTO app.approvals (tenant_id,id,offer_id,status,requested_by)
           VALUES ($1,$2,$3,'PENDING',$4)`, [tenantId, approvalId, offerId, actorId]);
      }
      await this.record(client, tenantId, actorId, 'offer.submitted', 'offer', offerId, { decision: decision.kind });
      return { offerId, status, decision: decision.kind, approvalId };
    });
  }

  async approve(tenantId: string, actorId: string, approvalId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_APPROVE');
      const approval = await this.db.one<{ offer_id: string; status: string }>(client,
        'SELECT offer_id,status FROM app.approvals WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, approvalId]);
      if (approval.status !== 'PENDING') throw new ConflictException({ code: 'APPROVAL_NOT_PENDING' });
      await client.query(
        `UPDATE app.approvals SET status='APPROVED', decided_by=$3, decided_at=now()
          WHERE tenant_id=$1 AND id=$2`, [tenantId, approvalId, actorId]);
      await client.query(`UPDATE app.offers SET status='APPROVED', updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, approval.offer_id]);
      await this.record(client, tenantId, actorId, 'offer.approved', 'offer', approval.offer_id, { approvalId });
      return { approvalId, offerId: approval.offer_id, status: 'APPROVED' };
    });
  }

  async activateContract(tenantId: string, actorId: string, offerId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const offer = await this.db.one<{ status: string }>(client,
        'SELECT status FROM app.offers WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, offerId]);
      if (offer.status !== 'APPROVED') throw new ConflictException({ code: 'OFFER_NOT_APPROVED' });
      const contractId = randomUUID();
      await client.query(
        `INSERT INTO app.contracts (tenant_id,id,offer_id,status,created_by)
         VALUES ($1,$2,$3,'ACTIVE',$4)`, [tenantId, contractId, offerId, actorId]);
      await client.query(
        `INSERT INTO app.contract_obligations
           (tenant_id,id,contract_id,code,title,status,created_by)
         VALUES
           ($1,$2,$3,'SIGNED_CONTRACT','Contrato assinado','PENDING',$5),
           ($1,$4,$3,'DELIVERY_SCHEDULE','Agenda de entrega','PENDING',$5)`,
        [tenantId, randomUUID(), contractId, randomUUID(), actorId]);
      await client.query(`UPDATE app.offers SET status='CONVERTED', updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, offerId]);
      await this.record(client, tenantId, actorId, 'contract.activated', 'contract', contractId, { offerId });
      return { contractId, offerId, status: 'ACTIVE' };
    });
  }

  async listContracts(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await this.db.one<{ legal_name: string; is_demo: boolean; demo_seed_version: number | null }>(
        client,
        `SELECT legal_name,is_demo,demo_seed_version FROM app.tenants WHERE id=$1`,
        [tenantId],
      );
      const result = await client.query(
        `SELECT c.id,c.status,c.activated_at::text,
                cp.legal_name AS counterparty_name,
                o.commodity,o.unit,o.quantity_sc,
                o.delivery_start::text,o.delivery_end::text,
                s.purchase_price_per_sc,s.projected_margin_per_sc,s.policy_version,
                COALESCE(load_totals.load_count,0)::integer AS load_count,
                COALESCE(load_totals.scheduled_weight_kg,0)::numeric(20,3) AS scheduled_weight_kg,
                COALESCE(load_totals.received_weight_kg,0)::numeric(20,3) AS received_weight_kg,
                GREATEST(o.quantity_sc * 60 - COALESCE(load_totals.scheduled_weight_kg,0),0)::numeric(20,3)
                  AS available_weight_kg,
                COALESCE(obligation_totals.pending_obligations,0)::integer AS pending_obligations
           FROM app.contracts c
           JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
           JOIN app.pricing_scenarios s
             ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
           LEFT JOIN LATERAL (
             SELECT count(*)::integer AS load_count,
                    COALESCE(sum(l.expected_weight_kg),0)::numeric(20,3) AS scheduled_weight_kg,
                    COALESCE(sum(r.net_weight_kg) FILTER (WHERE l.status='RECEIVED'),0)::numeric(20,3)
                      AS received_weight_kg
               FROM app.loads l
               LEFT JOIN app.load_receipts r
                 ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
              WHERE l.tenant_id=c.tenant_id AND l.contract_id=c.id AND l.status <> 'CANCELLED'
           ) load_totals ON true
           LEFT JOIN LATERAL (
             SELECT count(*) FILTER (WHERE ob.status IN ('PENDING','IN_PROGRESS'))::integer AS pending_obligations
               FROM app.contract_obligations ob
              WHERE ob.tenant_id=c.tenant_id AND ob.contract_id=c.id
           ) obligation_totals ON true
          WHERE c.tenant_id=$1
          ORDER BY c.activated_at DESC,c.id DESC`,
        [tenantId],
      );
      return {
        tenant: {
          legalName: tenant.legal_name,
          isDemo: tenant.is_demo,
          demoSeedVersion: tenant.demo_seed_version,
        },
        items: result.rows,
      };
    });
  }

  async contractSummary(tenantId: string, actorId: string, contractId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query(
        `SELECT c.id, c.status, o.commodity, o.unit, o.quantity_sc,
                o.delivery_start::text AS delivery_start, o.delivery_end::text AS delivery_end,
                s.purchase_price_per_sc, s.sale_reference_per_sc, s.total_costs_per_sc,
                s.projected_margin_per_sc, s.policy_version,
                CASE WHEN pct.contract_id IS NULL THEN NULL ELSE jsonb_build_object(
                  'externalNumber', pct.external_number,
                  'cropYear', pct.crop_year,
                  'signedOn', pct.signed_on,
                  'pickupLocation', pct.pickup_location,
                  'deliveryCondition', pct.delivery_condition,
                  'freightPayer', pct.freight_payer,
                  'weighingResponsibility', pct.weighing_responsibility,
                  'qualityTerms', pct.quality_terms,
                  'requiredDocuments', pct.required_documents,
                  'paymentTerms', pct.payment_terms,
                  'version', pct.version,
                  'updatedAt', pct.updated_at
                ) END AS purchase_terms,
                COALESCE(load_totals.load_count,0)::integer AS load_count,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'id', ob.id,
                  'code', ob.code,
                  'title', COALESCE(ob.title, CASE ob.code
                    WHEN 'SIGNED_CONTRACT' THEN 'Contrato assinado'
                    WHEN 'DELIVERY_SCHEDULE' THEN 'Agenda de entrega'
                    ELSE ob.code END),
                  'description', ob.description,
                  'due_date', ob.due_date,
                  'responsible_name', ob.responsible_name,
                  'status', ob.status,
                  'completed_at', ob.completed_at,
                  'created_at', ob.created_at,
                  'updated_at', ob.updated_at,
                  'evidence', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                      'documentId', ev.document_id,
                      'fileName', doc.file_name,
                      'documentType', doc.document_type,
                      'status', doc.status,
                      'linkedAt', ev.linked_at
                    ) ORDER BY ev.linked_at, ev.document_id)
                    FROM app.contract_obligation_evidence ev
                    JOIN app.documents doc ON (doc.tenant_id,doc.id)=(ev.tenant_id,ev.document_id)
                    WHERE ev.tenant_id=ob.tenant_id AND ev.obligation_id=ob.id
                  ),'[]'::jsonb)
                ) ORDER BY ob.due_date NULLS LAST, ob.created_at, ob.id)
                  FILTER (WHERE ob.id IS NOT NULL), '[]'::jsonb) AS obligations
           FROM app.contracts c
           JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
           LEFT JOIN app.purchase_contract_terms pct
             ON (pct.tenant_id,pct.contract_id)=(c.tenant_id,c.id)
           LEFT JOIN LATERAL (
             SELECT count(*)::integer AS load_count
               FROM app.loads l
              WHERE l.tenant_id=c.tenant_id AND l.contract_id=c.id AND l.status <> 'CANCELLED'
           ) load_totals ON true
           LEFT JOIN app.contract_obligations ob ON (ob.tenant_id,ob.contract_id)=(c.tenant_id,c.id)
          WHERE c.tenant_id=$1 AND c.id=$2
          GROUP BY c.id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,o.delivery_end,
                   s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,
                   s.projected_margin_per_sc,s.policy_version,load_totals.load_count,
                   pct.contract_id,pct.external_number,pct.crop_year,pct.signed_on,
                   pct.pickup_location,pct.delivery_condition,pct.freight_payer,
                   pct.weighing_responsibility,pct.quality_terms,pct.required_documents,
                   pct.payment_terms,pct.version,pct.updated_at`, [tenantId, contractId]);
      if (!result.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
      return result.rows[0];
    });
  }

  async savePurchaseTerms(tenantId: string, actorId: string, contractId: string,
    input: PurchaseContractTermsInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const contract = await client.query<{ status: string }>(
        'SELECT status FROM app.contracts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, contractId],
      );
      if (!contract.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
      if (contract.rows[0].status !== 'ACTIVE') throw new ConflictException({ code: 'CONTRACT_NOT_ACTIVE' });
      const before = await client.query(
        'SELECT * FROM app.purchase_contract_terms WHERE tenant_id=$1 AND contract_id=$2 FOR UPDATE',
        [tenantId, contractId],
      );
      const previous = before.rows[0] ?? null;
      if ((previous?.version ?? 0) !== input.expectedVersion) {
        throw new ConflictException({ code: 'PURCHASE_TERMS_VERSION_CONFLICT' });
      }
      const values = [tenantId, contractId, input.externalNumber, input.cropYear, input.signedOn,
        input.pickupLocation, input.deliveryCondition, input.freightPayer, input.weighingResponsibility,
        input.qualityTerms, input.requiredDocuments, input.paymentTerms, actorId];
      const saved = await client.query(
        `INSERT INTO app.purchase_contract_terms
          (tenant_id,contract_id,external_number,crop_year,signed_on,pickup_location,
           delivery_condition,freight_payer,weighing_responsibility,quality_terms,
           required_documents,payment_terms,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
         ON CONFLICT (tenant_id,contract_id) DO UPDATE SET
           external_number=excluded.external_number,crop_year=excluded.crop_year,
           signed_on=excluded.signed_on,pickup_location=excluded.pickup_location,
           delivery_condition=excluded.delivery_condition,freight_payer=excluded.freight_payer,
           weighing_responsibility=excluded.weighing_responsibility,quality_terms=excluded.quality_terms,
           required_documents=excluded.required_documents,payment_terms=excluded.payment_terms,
           updated_by=excluded.updated_by,updated_at=now(),version=app.purchase_contract_terms.version+1
         RETURNING external_number AS "externalNumber",crop_year AS "cropYear",signed_on AS "signedOn",
           pickup_location AS "pickupLocation",delivery_condition AS "deliveryCondition",
           freight_payer AS "freightPayer",weighing_responsibility AS "weighingResponsibility",
           quality_terms AS "qualityTerms",required_documents AS "requiredDocuments",
           payment_terms AS "paymentTerms",version,updated_at AS "updatedAt"`, values,
      );
      await this.record(client, tenantId, actorId, 'contract.purchase_terms_saved', 'contract', contractId,
        { before: previous, after: saved.rows[0] });
      return saved.rows[0];
    });
  }

  async listOpenContractObligations(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query(
        `SELECT ob.id,ob.contract_id,ob.code,
                COALESCE(ob.title, CASE ob.code
                  WHEN 'SIGNED_CONTRACT' THEN 'Contrato assinado'
                  WHEN 'DELIVERY_SCHEDULE' THEN 'Agenda de entrega'
                  ELSE ob.code END) AS title,
                ob.description,ob.due_date::text,ob.responsible_name,ob.status,
                cp.legal_name AS counterparty_name,o.commodity
           FROM app.contract_obligations ob
           JOIN app.contracts c ON (c.tenant_id,c.id)=(ob.tenant_id,ob.contract_id)
           JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           JOIN app.counterparties cp ON (cp.tenant_id,cp.id)=(o.tenant_id,o.counterparty_id)
          WHERE ob.tenant_id=$1 AND c.status='ACTIVE'
            AND ob.status IN ('PENDING','IN_PROGRESS')
          ORDER BY ob.due_date NULLS LAST,ob.created_at,ob.id
          LIMIT 101`, [tenantId]);
      return { items: result.rows.slice(0, 100), hasMore: result.rows.length > 100 };
    });
  }

  async createContractObligation(tenantId: string, actorId: string, contractId: string,
    input: CreateContractObligationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const contract = await client.query<{ status: string }>(
        'SELECT status FROM app.contracts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, contractId],
      );
      if (!contract.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
      if (contract.rows[0].status !== 'ACTIVE') {
        throw new ConflictException({ code: 'CONTRACT_NOT_ACTIVE' });
      }
      const obligationId = randomUUID();
      const code = `CUSTOM_${obligationId.replaceAll('-', '').toUpperCase()}`;
      const result = await client.query(
        `INSERT INTO app.contract_obligations
           (tenant_id,id,contract_id,code,title,description,due_date,responsible_name,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9)
         RETURNING id,code,title,description,due_date::text,responsible_name,status,
                   completed_at::text,created_at::text,updated_at::text`,
        [tenantId, obligationId, contractId, code, input.title, input.description, input.dueDate,
          input.responsibleName, actorId],
      );
      await this.record(client, tenantId, actorId, 'contract.obligation.created', 'contract', contractId,
        { obligationId, code, title: input.title, dueDate: input.dueDate, responsibleName: input.responsibleName });
      return result.rows[0];
    });
  }

  async updateContractObligation(tenantId: string, actorId: string, contractId: string,
    obligationId: string, input: UpdateContractObligationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const obligation = await client.query<{
        status: string; code: string; title: string | null; description: string | null;
        due_date: string | null; responsible_name: string | null;
      }>(
        `SELECT status,code,title,description,due_date::text,responsible_name
           FROM app.contract_obligations
          WHERE tenant_id=$1 AND contract_id=$2 AND id=$3 FOR UPDATE`,
        [tenantId, contractId, obligationId],
      );
      if (!obligation.rows[0]) throw new NotFoundException({ code: 'CONTRACT_OBLIGATION_NOT_FOUND' });
      const completed = input.status === 'COMPLETED';
      const result = await client.query(
        `UPDATE app.contract_obligations
            SET title=$4,description=$5,due_date=$6,responsible_name=$7,status=$8,
                completed_at=CASE WHEN $8='COMPLETED' THEN COALESCE(completed_at,now()) ELSE NULL END,
                completed_by=CASE WHEN $8='COMPLETED' THEN COALESCE(completed_by,$9::uuid) ELSE NULL END,
                updated_at=now()
          WHERE tenant_id=$1 AND contract_id=$2 AND id=$3
        RETURNING id,code,title,description,due_date::text,responsible_name,status,
                  completed_at::text,created_at::text,updated_at::text`,
        [tenantId, contractId, obligationId, input.title, input.description, input.dueDate,
          input.responsibleName, input.status, actorId],
      );
      await this.record(client, tenantId, actorId, 'contract.obligation.updated', 'contract', contractId,
        { obligationId, code: obligation.rows[0].code,
          before: { title: obligation.rows[0].title, description: obligation.rows[0].description,
            dueDate: obligation.rows[0].due_date, responsibleName: obligation.rows[0].responsible_name,
            status: obligation.rows[0].status },
          after: { title: input.title, description: input.description, dueDate: input.dueDate,
            responsibleName: input.responsibleName, status: input.status },
          completedAtSet: completed });
      return result.rows[0];
    });
  }

  async attachContractObligationEvidence(tenantId: string, actorId: string, contractId: string,
    obligationId: string, input: AttachContractObligationEvidenceInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'COMMERCIAL_EDIT');
      const obligation = await client.query<{ id: string }>(
        `SELECT ob.id FROM app.contract_obligations ob
         JOIN app.contracts c ON (c.tenant_id,c.id)=(ob.tenant_id,ob.contract_id)
         WHERE ob.tenant_id=$1 AND ob.contract_id=$2 AND ob.id=$3 AND c.status='ACTIVE'`,
        [tenantId, contractId, obligationId],
      );
      if (!obligation.rows[0]) throw new NotFoundException({ code: 'CONTRACT_OBLIGATION_NOT_FOUND' });
      const document = await client.query<{ id: string }>(
        `SELECT id FROM app.documents WHERE tenant_id=$1 AND id=$2
          AND aggregate_type='CONTRACT' AND aggregate_id=$3 AND status='AVAILABLE'`,
        [tenantId, input.documentId, contractId],
      );
      if (!document.rows[0]) throw new UnprocessableEntityException({ code: 'CONTRACT_EVIDENCE_NOT_AVAILABLE' });
      const inserted = await client.query(
        `INSERT INTO app.contract_obligation_evidence
          (tenant_id,obligation_id,document_id,linked_by) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING RETURNING document_id`,
        [tenantId, obligationId, input.documentId, actorId],
      );
      if (inserted.rowCount) {
        await this.record(client, tenantId, actorId, 'contract.obligation.evidence_linked',
          'contract', contractId, { obligationId, documentId: input.documentId });
      }
      return { obligationId, documentId: input.documentId, linked: Boolean(inserted.rowCount) };
    });
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true`, [tenantId, actorId]);
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query(
      `SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true
        AND $3 = ANY(capabilities)`, [tenantId, actorId, capability]);
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
  }

  private assertDeliveryWindow(input: CreateOfferInput) {
    if (input.deliveryEnd < input.deliveryStart) {
      throw new UnprocessableEntityException({ code: 'INVALID_DELIVERY_WINDOW' });
    }
  }

  private assertDemandWindow(input: CreateCommercialDemandInput) {
    if (input.deliveryEnd < input.deliveryStart) {
      throw new UnprocessableEntityException({ code: 'INVALID_DELIVERY_WINDOW' });
    }
  }

  private activeMarginPolicy(client: PoolClient, tenantId: string, commodity: string) {
    return this.db.one<MarginPolicyRow>(client,
      `SELECT id,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc
         FROM app.margin_policies WHERE tenant_id=$1 AND commodity=$2 AND active=true`,
      [tenantId, commodity]);
  }

  private async assertClassifiedCounterparty(client: PoolClient, tenantId: string, counterpartyId: string) {
    const counterparty = await client.query<{ party_type: string }>(
      'SELECT party_type FROM app.counterparties WHERE tenant_id=$1 AND id=$2',
      [tenantId, counterpartyId]);
    if (counterparty.rowCount !== 1) throw new NotFoundException({ code: 'COUNTERPARTY_NOT_FOUND' });
    if (counterparty.rows[0]?.party_type === 'UNCLASSIFIED') {
      throw new UnprocessableEntityException({ code: 'COUNTERPARTY_PROFILE_REQUIRED' });
    }
  }

  private async record(client: PoolClient, tenantId: string, actorId: string, eventType: string,
    aggregateType: string, aggregateId: string, payload: object) {
    const eventId = randomUUID();
    await client.query(
      `INSERT INTO app.audit_events (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tenantId, eventId, actorId, eventType, aggregateType, aggregateId, JSON.stringify(payload)]);
    await client.query(
      `INSERT INTO app.outbox_events (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [tenantId, eventId, eventType, aggregateType, aggregateId, JSON.stringify(payload)]);
  }
}
