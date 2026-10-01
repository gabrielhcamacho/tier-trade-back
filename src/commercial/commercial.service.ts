import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { calculateProjectedMargin, decideSubmission } from '../domain/pricing.js';
import type { CreateOfferInput } from './commercial.schemas.js';

interface MarginPolicyRow {
  id: string;
  version: number;
  auto_approval_margin_per_sc: string;
  absolute_floor_margin_per_sc: string;
}

@Injectable()
export class CommercialService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  async createOffer(tenantId: string, actorId: string, input: CreateOfferInput) {
    if (input.deliveryEnd < input.deliveryStart) {
      throw new UnprocessableEntityException({ code: 'INVALID_DELIVERY_WINDOW' });
    }
    const pricing = calculateProjectedMargin(input);
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
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

  async submitOffer(tenantId: string, actorId: string, offerId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const row = await this.db.one<MarginPolicyRow & { status: string; projected_margin_per_sc: string }>(
        client,
        `SELECT o.status, s.projected_margin_per_sc, p.id, p.version,
                p.auto_approval_margin_per_sc, p.absolute_floor_margin_per_sc
           FROM app.offers o
           JOIN app.pricing_scenarios s ON (s.tenant_id, s.offer_id) = (o.tenant_id, o.id)
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
      await this.assertMember(client, tenantId, actorId);
      const offer = await this.db.one<{ status: string }>(client,
        'SELECT status FROM app.offers WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, offerId]);
      if (offer.status !== 'APPROVED') throw new ConflictException({ code: 'OFFER_NOT_APPROVED' });
      const contractId = randomUUID();
      await client.query(
        `INSERT INTO app.contracts (tenant_id,id,offer_id,status,created_by)
         VALUES ($1,$2,$3,'ACTIVE',$4)`, [tenantId, contractId, offerId, actorId]);
      await client.query(
        `INSERT INTO app.contract_obligations (tenant_id,id,contract_id,code,status)
         VALUES ($1,$2,$3,'SIGNED_CONTRACT','PENDING'),($1,$4,$3,'DELIVERY_SCHEDULE','PENDING')`,
        [tenantId, randomUUID(), contractId, randomUUID()]);
      await client.query(`UPDATE app.offers SET status='CONVERTED', updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, offerId]);
      await this.record(client, tenantId, actorId, 'contract.activated', 'contract', contractId, { offerId });
      return { contractId, offerId, status: 'ACTIVE' };
    });
  }

  async contractSummary(tenantId: string, actorId: string, contractId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query(
        `SELECT c.id, c.status, o.commodity, o.unit, o.quantity_sc, o.delivery_start, o.delivery_end,
                s.purchase_price_per_sc, s.sale_reference_per_sc, s.total_costs_per_sc,
                s.projected_margin_per_sc, s.policy_version,
                COALESCE(jsonb_agg(jsonb_build_object('code', ob.code, 'status', ob.status))
                  FILTER (WHERE ob.id IS NOT NULL), '[]'::jsonb) AS obligations
           FROM app.contracts c
           JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           JOIN app.pricing_scenarios s ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id)
           LEFT JOIN app.contract_obligations ob ON (ob.tenant_id,ob.contract_id)=(c.tenant_id,c.id)
          WHERE c.tenant_id=$1 AND c.id=$2
          GROUP BY c.id,c.status,o.commodity,o.unit,o.quantity_sc,o.delivery_start,o.delivery_end,
                   s.purchase_price_per_sc,s.sale_reference_per_sc,s.total_costs_per_sc,
                   s.projected_margin_per_sc,s.policy_version`, [tenantId, contractId]);
      if (!result.rows[0]) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
      return result.rows[0];
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
