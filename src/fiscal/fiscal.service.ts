import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type {
  CreateFiscalDocumentInput, RejectFiscalDocumentInput, UpdateFiscalDocumentInput,
} from './fiscal.schemas.js';

type FiscalDocumentRow = {
  id: string; financial_event_id: string; source_id: string; sales_contract_id: string;
  contract_reference: string; counterparty_name: string; dispatch_reference: string;
  document_number: string; access_key: string | null; issued_at: Date; total_amount: string;
  expected_amount: string | null; status: string; validation_notes: string | null;
  rejection_reason: string | null; updated_at: Date; validated_at: Date | null;
  title_id: string | null; title_number: string | null; title_status: string | null;
};

@Injectable()
export class FiscalService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  workspace(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const tenant = await client.query<{
        legal_name: string; is_demo: boolean; demo_seed_version: number | null;
      }>('SELECT legal_name,is_demo,demo_seed_version FROM app.tenants WHERE id=$1', [tenantId]);
      const documents = await client.query<FiscalDocumentRow>(
        `SELECT fd.id,fd.financial_event_id,fd.source_id,fd.sales_contract_id,
                sc.reference AS contract_reference,cp.legal_name AS counterparty_name,
                d.document_reference AS dispatch_reference,fd.document_number,fd.access_key,
                fd.issued_at,fd.total_amount::text,fe.calculated_amount::text AS expected_amount,
                fd.status,fd.validation_notes,fd.rejection_reason,fd.updated_at,fd.validated_at,
                ft.id AS title_id,ft.title_number,ft.status AS title_status
           FROM app.fiscal_documents fd
           JOIN app.financial_events fe
             ON (fe.tenant_id,fe.id)=(fd.tenant_id,fd.financial_event_id)
           JOIN app.inventory_dispatches d
             ON (d.tenant_id,d.id)=(fd.tenant_id,fd.source_id)
           JOIN app.sales_contracts sc
             ON (sc.tenant_id,sc.id)=(fd.tenant_id,fd.sales_contract_id)
           JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(fe.tenant_id,fe.counterparty_id)
           LEFT JOIN app.financial_titles ft
             ON (ft.tenant_id,ft.fiscal_document_id)=(fd.tenant_id,fd.id)
          WHERE fd.tenant_id=$1 ORDER BY fd.issued_at DESC,fd.id DESC`, [tenantId]);
      const eligible = await client.query<{
        id: string; source_id: string; sales_contract_id: string; contract_reference: string;
        counterparty_name: string; dispatch_reference: string; calculated_amount: string | null;
        calculation_status: string;
      }>(
        `SELECT fe.id,fe.source_id,fe.sales_contract_id,sc.reference AS contract_reference,
                cp.legal_name AS counterparty_name,d.document_reference AS dispatch_reference,
                fe.calculated_amount::text,fe.calculation_status
           FROM app.financial_events fe
           JOIN app.inventory_dispatches d
             ON (d.tenant_id,d.id)=(fe.tenant_id,fe.source_id)
           JOIN app.sales_contracts sc
             ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
           JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(fe.tenant_id,fe.counterparty_id)
           LEFT JOIN app.fiscal_documents fd
             ON (fd.tenant_id,fd.financial_event_id)=(fe.tenant_id,fe.id)
          WHERE fe.tenant_id=$1 AND fd.id IS NULL
          ORDER BY fe.created_at DESC`, [tenantId]);
      const mapped = documents.rows.map((row) => this.mapDocument(row));
      return {
        tenant: {
          legalName: tenant.rows[0]!.legal_name,
          isDemo: tenant.rows[0]!.is_demo,
          demoSeedVersion: tenant.rows[0]!.demo_seed_version,
        },
        summary: {
          received: mapped.filter((document) => document.status === 'RECEIVED').length,
          validated: mapped.filter((document) => document.status === 'VALIDATED').length,
          rejected: mapped.filter((document) => document.status === 'REJECTED').length,
          linkedTitles: mapped.filter((document) => document.title !== null).length,
        },
        documents: mapped,
        eligibleEvents: eligible.rows.map((row) => ({
          id: row.id, sourceId: row.source_id, salesContractId: row.sales_contract_id,
          contractReference: row.contract_reference, counterpartyName: row.counterparty_name,
          dispatchReference: row.dispatch_reference, expectedAmount: row.calculated_amount,
          calculationStatus: row.calculation_status,
        })),
        taxCalculation: {
          status: 'BLOCKED_CONFIGURATION',
          blockers: [
            'UFs, estabelecimentos, regimes, CFOPs e incidências do piloto ainda não homologados.',
            'Responsável técnico fiscal e estratégia de emissão ainda não definidos.',
          ],
        },
      };
    });
  }

  create(tenantId: string, actorId: string, input: CreateFiscalDocumentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const source = await this.sourceForEvent(client, tenantId, input.financialEventId);
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.fiscal_documents
            (tenant_id,id,document_type,direction,source_type,source_id,sales_contract_id,
             financial_event_id,document_number,access_key,issued_at,total_amount,
             validation_notes,created_by,updated_by)
           VALUES ($1,$2,'NFE','OUTBOUND','INVENTORY_DISPATCH',$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
          [tenantId, id, source.source_id, source.sales_contract_id, input.financialEventId,
            input.documentNumber, input.accessKey, input.issuedAt, input.totalAmount,
            input.validationNotes, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'FISCAL_DOCUMENT_ALREADY_EXISTS' });
        throw error;
      }
      await this.record(client, tenantId, actorId, 'fiscal.document_received', 'fiscal_document', id,
        { financialEventId: input.financialEventId, documentNumber: input.documentNumber });
      return { id, status: 'RECEIVED' };
    });
  }

  update(tenantId: string, actorId: string, documentId: string, input: UpdateFiscalDocumentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const existing = await this.lockDocument(client, tenantId, documentId);
      try {
        await client.query(
          `UPDATE app.fiscal_documents
              SET document_number=$3,access_key=$4,issued_at=$5,total_amount=$6,
                  validation_notes=$7,status='RECEIVED',rejection_reason=NULL,
                  validated_by=NULL,validated_at=NULL,updated_by=$8,updated_at=now()
            WHERE tenant_id=$1 AND id=$2`,
          [tenantId, documentId, input.documentNumber, input.accessKey, input.issuedAt,
            input.totalAmount, input.validationNotes, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'FISCAL_DOCUMENT_ALREADY_EXISTS' });
        throw error;
      }
      await client.query(
        `UPDATE app.financial_titles SET fiscal_document_id=NULL
          WHERE tenant_id=$1 AND fiscal_document_id=$2`, [tenantId, documentId]);
      await this.record(client, tenantId, actorId, 'fiscal.document_corrected', 'fiscal_document', documentId,
        { previousStatus: existing.status, documentNumber: input.documentNumber });
      return { id: documentId, status: 'RECEIVED' };
    });
  }

  validate(tenantId: string, actorId: string, documentId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const document = await this.lockDocument(client, tenantId, documentId);
      if (document.status === 'VALIDATED') throw new ConflictException({ code: 'FISCAL_DOCUMENT_ALREADY_VALIDATED' });
      if (!document.access_key) throw new UnprocessableEntityException({ code: 'FISCAL_ACCESS_KEY_REQUIRED' });
      if (document.calculation_status !== 'READY' || !document.calculated_amount) {
        throw new ConflictException({ code: 'FISCAL_FINANCIAL_EVENT_NOT_READY' });
      }
      const difference = new Decimal(document.total_amount).minus(document.calculated_amount);
      if (!difference.isZero()) {
        throw new UnprocessableEntityException({
          code: 'FISCAL_DOCUMENT_VALUE_DIVERGENCE', expectedAmount: document.calculated_amount,
          informedAmount: document.total_amount, difference: difference.toFixed(2),
        });
      }
      await client.query(
        `UPDATE app.fiscal_documents
            SET status='VALIDATED',rejection_reason=NULL,validated_by=$3,validated_at=now(),
                updated_by=$3,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`, [tenantId, documentId, actorId]);
      const linked = await client.query<{ id: string }>(
        `UPDATE app.financial_titles SET fiscal_document_id=$3
          WHERE tenant_id=$1 AND financial_event_id=$2 RETURNING id`,
        [tenantId, document.financial_event_id, documentId]);
      await this.record(client, tenantId, actorId, 'fiscal.document_validated', 'fiscal_document', documentId,
        { financialEventId: document.financial_event_id, linkedTitleId: linked.rows[0]?.id ?? null });
      return { id: documentId, status: 'VALIDATED', linkedTitleId: linked.rows[0]?.id ?? null };
    });
  }

  reject(tenantId: string, actorId: string, documentId: string, input: RejectFiscalDocumentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      await this.lockDocument(client, tenantId, documentId);
      await client.query(
        `UPDATE app.fiscal_documents
            SET status='REJECTED',rejection_reason=$3,validated_by=$4,validated_at=now(),
                updated_by=$4,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`, [tenantId, documentId, input.reason, actorId]);
      await client.query(
        'UPDATE app.financial_titles SET fiscal_document_id=NULL WHERE tenant_id=$1 AND fiscal_document_id=$2',
        [tenantId, documentId]);
      await this.record(client, tenantId, actorId, 'fiscal.document_rejected', 'fiscal_document', documentId,
        { reason: input.reason });
      return { id: documentId, status: 'REJECTED' };
    });
  }

  private mapDocument(row: FiscalDocumentRow) {
    const expected = row.expected_amount ? new Decimal(row.expected_amount) : null;
    const total = new Decimal(row.total_amount);
    return {
      id: row.id, financialEventId: row.financial_event_id, sourceId: row.source_id,
      salesContractId: row.sales_contract_id, contractReference: row.contract_reference,
      counterpartyName: row.counterparty_name, dispatchReference: row.dispatch_reference,
      documentType: 'NFE', direction: 'OUTBOUND', documentNumber: row.document_number,
      accessKey: row.access_key, issuedAt: row.issued_at.toISOString(), totalAmount: row.total_amount,
      expectedAmount: row.expected_amount,
      differenceAmount: expected ? total.minus(expected).toFixed(2) : null,
      status: row.status, validationNotes: row.validation_notes,
      rejectionReason: row.rejection_reason, updatedAt: row.updated_at.toISOString(),
      validatedAt: row.validated_at?.toISOString() ?? null,
      title: row.title_id ? { id: row.title_id, number: row.title_number!, status: row.title_status! } : null,
    };
  }

  private async sourceForEvent(client: PoolClient, tenantId: string, financialEventId: string) {
    const source = await client.query<{ source_id: string; sales_contract_id: string }>(
      `SELECT source_id,sales_contract_id FROM app.financial_events
        WHERE tenant_id=$1 AND id=$2`, [tenantId, financialEventId]);
    if (!source.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_EVENT_NOT_FOUND' });
    return source.rows[0];
  }

  private async lockDocument(client: PoolClient, tenantId: string, documentId: string) {
    const result = await client.query<{
      financial_event_id: string; status: string; access_key: string | null;
      total_amount: string; calculated_amount: string | null; calculation_status: string;
    }>(
      `SELECT fd.financial_event_id,fd.status,fd.access_key,fd.total_amount::text,
              fe.calculated_amount::text,fe.calculation_status
         FROM app.fiscal_documents fd
         JOIN app.financial_events fe
           ON (fe.tenant_id,fe.id)=(fd.tenant_id,fd.financial_event_id)
        WHERE fd.tenant_id=$1 AND fd.id=$2 FOR UPDATE OF fd`, [tenantId, documentId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'FISCAL_DOCUMENT_NOT_FOUND' });
    return result.rows[0];
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(
      'SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true',
      [tenantId, actorId]);
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query<{ capabilities: string[] }>(
      'SELECT capabilities FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true',
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
