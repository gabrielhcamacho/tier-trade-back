import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type { CreateUploadRequestInput, SignatureInput } from './documents.schemas.js';

const bucket = 'tier-trade-documents';
const aggregateTables: Record<CreateUploadRequestInput['aggregateType'], string> = {
  CONTRACT: 'contracts', SALES_CONTRACT: 'sales_contracts', LOAD: 'loads',
  FISCAL_DOCUMENT: 'fiscal_documents', COUNTERPARTY: 'counterparties', INVENTORY_LOT: 'inventory_lots',
};

@Injectable()
export class DocumentsService {
  private storageClient: SupabaseClient | null = null;

  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  private get storage(): SupabaseClient {
    if (this.storageClient) return this.storageClient;
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for document storage.');
    }
    this.storageClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.storageClient;
  }

  list(tenantId: string, actorId: string, aggregateType?: string, aggregateId?: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const result = await client.query(
        `SELECT d.id,d.aggregate_type,d.aggregate_id,d.document_type,d.file_name,d.mime_type,
                d.size_bytes::text,d.status,d.version,d.notes,d.uploaded_at,d.created_at,
                d.contract_version_number,d.sales_contract_version_number,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'id',s.id,'provider',s.provider,'externalEnvelopeId',s.external_envelope_id,
                  'signerName',s.signer_name,'signerEmail',s.signer_email,'signerRole',s.signer_role,
                  'status',s.status,'sentAt',s.sent_at,'signedAt',s.signed_at
                ) ORDER BY s.created_at,s.id) FILTER (WHERE s.id IS NOT NULL),'[]'::jsonb) AS signatures
           FROM app.documents d
           LEFT JOIN app.document_signatures s ON (s.tenant_id,s.document_id)=(d.tenant_id,d.id)
          WHERE d.tenant_id=$1 AND ($2::text IS NULL OR d.aggregate_type=$2)
            AND ($3::uuid IS NULL OR d.aggregate_id=$3)
          GROUP BY d.id,d.aggregate_type,d.aggregate_id,d.document_type,d.file_name,d.mime_type,
                   d.size_bytes,d.status,d.version,d.notes,d.uploaded_at,d.created_at,
                   d.contract_version_number,d.sales_contract_version_number
          ORDER BY d.created_at DESC,d.id DESC`, [tenantId, aggregateType ?? null, aggregateId ?? null]);
      return { items: result.rows };
    });
  }

  createUploadRequest(tenantId: string, actorId: string, input: CreateUploadRequestInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertEditor(client, tenantId, actorId);
      await this.assertAggregate(client, tenantId, input.aggregateType, input.aggregateId);
      const id = randomUUID();
      const version = await this.nextVersion(client, tenantId, input);
      const aggregateVersion = await this.currentAggregateVersion(client, tenantId, input);
      const safeName = input.fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 180);
      const storagePath = `${tenantId}/${input.aggregateType.toLowerCase()}/${input.aggregateId}/${id}/${safeName}`;
      const signed = await this.storage.storage.from(bucket).createSignedUploadUrl(storagePath, { upsert: false });
      if (signed.error || !signed.data) {
        throw new ServiceUnavailableException({ code: 'DOCUMENT_UPLOAD_URL_FAILED' });
      }
      await client.query(
        `INSERT INTO app.documents
          (tenant_id,id,aggregate_type,aggregate_id,document_type,file_name,mime_type,size_bytes,
           storage_bucket,storage_path,version,notes,created_by,
           contract_version_number,sales_contract_version_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [tenantId, id, input.aggregateType, input.aggregateId, input.documentType, input.fileName,
          input.mimeType, input.sizeBytes, bucket, storagePath, version, input.notes, actorId,
          aggregateVersion.contractVersion, aggregateVersion.salesContractVersion]);
      await this.record(client, tenantId, actorId, 'document.upload_requested', id, {
        aggregateType: input.aggregateType, aggregateId: input.aggregateId,
        documentType: input.documentType, version,
      });
      return { id, version, status: 'PENDING_UPLOAD', storagePath,
        signedUploadUrl: signed.data.signedUrl, uploadToken: signed.data.token };
    });
  }

  completeUpload(tenantId: string, actorId: string, documentId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertEditor(client, tenantId, actorId);
      const document = await client.query<{ storage_path: string; status: string }>(
        `SELECT storage_path,status FROM app.documents WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, documentId]);
      if (!document.rows[0]) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
      if (document.rows[0].status === 'AVAILABLE') return { id: documentId, status: 'AVAILABLE' };
      const path = document.rows[0].storage_path;
      const slash = path.lastIndexOf('/');
      const listed = await this.storage.storage.from(bucket).list(path.slice(0, slash), {
        search: path.slice(slash + 1), limit: 10,
      });
      if (listed.error || !listed.data?.some((item) => item.name === path.slice(slash + 1))) {
        throw new ConflictException({ code: 'DOCUMENT_OBJECT_NOT_FOUND' });
      }
      await client.query(`UPDATE app.documents SET status='AVAILABLE',uploaded_at=now(),updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, documentId]);
      await this.record(client, tenantId, actorId, 'document.upload_completed', documentId, {});
      return { id: documentId, status: 'AVAILABLE' };
    });
  }

  download(tenantId: string, actorId: string, documentId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const document = await client.query<{ storage_path: string; status: string; file_name: string }>(
        `SELECT storage_path,status,file_name FROM app.documents WHERE tenant_id=$1 AND id=$2`,
        [tenantId, documentId]);
      if (!document.rows[0]) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
      if (document.rows[0].status !== 'AVAILABLE') throw new ConflictException({ code: 'DOCUMENT_NOT_AVAILABLE' });
      const signed = await this.storage.storage.from(bucket).createSignedUrl(document.rows[0].storage_path, 60, {
        download: document.rows[0].file_name,
      });
      if (signed.error || !signed.data) {
        throw new ServiceUnavailableException({ code: 'DOCUMENT_DOWNLOAD_URL_FAILED' });
      }
      return { id: documentId, expiresInSeconds: 60, signedUrl: signed.data.signedUrl };
    });
  }

  addSignature(tenantId: string, actorId: string, documentId: string, input: SignatureInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertEditor(client, tenantId, actorId);
      const document = await client.query(`SELECT 1 FROM app.documents WHERE tenant_id=$1 AND id=$2`,
        [tenantId, documentId]);
      if (!document.rows[0]) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.document_signatures
          (tenant_id,id,document_id,provider,external_envelope_id,signer_name,signer_email,
           signer_role,status,sent_at,signed_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [tenantId, id, documentId, input.provider, input.externalEnvelopeId, input.signerName,
          input.signerEmail, input.signerRole, input.status, input.sentAt, input.signedAt, actorId]);
      await this.record(client, tenantId, actorId, 'document.signature_recorded', documentId, { signatureId: id, ...input });
      return { id, documentId, ...input };
    });
  }

  private async nextVersion(client: PoolClient, tenantId: string, input: CreateUploadRequestInput) {
    const result = await client.query<{ version: number }>(
      `SELECT COALESCE(max(version),0)+1 AS version FROM app.documents
        WHERE tenant_id=$1 AND aggregate_type=$2 AND aggregate_id=$3 AND document_type=$4`,
      [tenantId, input.aggregateType, input.aggregateId, input.documentType]);
    return Number(result.rows[0]!.version);
  }

  private async currentAggregateVersion(client: PoolClient, tenantId: string, input: CreateUploadRequestInput) {
    if (input.aggregateType === 'CONTRACT') {
      const result = await client.query<{ version: number }>(
        `SELECT max(version_number)::integer AS version FROM app.contract_versions
          WHERE tenant_id=$1 AND contract_id=$2`, [tenantId, input.aggregateId]);
      return { contractVersion: result.rows[0]?.version ?? null, salesContractVersion: null };
    }
    if (input.aggregateType === 'SALES_CONTRACT') {
      const result = await client.query<{ version: number }>(
        `SELECT max(version_number)::integer AS version FROM app.sales_contract_versions
          WHERE tenant_id=$1 AND sales_contract_id=$2`, [tenantId, input.aggregateId]);
      return { contractVersion: null, salesContractVersion: result.rows[0]?.version ?? null };
    }
    return { contractVersion: null, salesContractVersion: null };
  }

  private async assertAggregate(client: PoolClient, tenantId: string,
    aggregateType: CreateUploadRequestInput['aggregateType'], aggregateId: string) {
    const table = aggregateTables[aggregateType];
    const result = await client.query(`SELECT 1 FROM app.${table} WHERE tenant_id=$1 AND id=$2`,
      [tenantId, aggregateId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'DOCUMENT_AGGREGATE_NOT_FOUND' });
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query(`SELECT 1 FROM app.memberships
      WHERE tenant_id=$1 AND user_id=$2 AND active=true`, [tenantId, actorId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertEditor(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query<{ capabilities: string[] }>(`SELECT capabilities FROM app.memberships
      WHERE tenant_id=$1 AND user_id=$2 AND active=true`, [tenantId, actorId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
    if (!result.rows[0].capabilities.some((capability) =>
      ['COMMERCIAL_EDIT', 'OPERATIONS_EDIT', 'FISCAL_EDIT', 'FINANCE_EDIT'].includes(capability))) {
      throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
    }
  }

  private async record(client: PoolClient, tenantId: string, actorId: string,
    eventType: string, documentId: string, payload: unknown) {
    const id = randomUUID();
    const body = JSON.stringify(payload);
    await client.query(`INSERT INTO app.audit_events
      (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES ($1,$2,$3,$4,'document',$5,$6::jsonb)`, [tenantId, id, actorId, eventType, documentId, body]);
    await client.query(`INSERT INTO app.outbox_events
      (tenant_id,id,event_type,aggregate_type,aggregate_id,payload)
      VALUES ($1,$2,$3,'document',$4,$5::jsonb)`, [tenantId, id, eventType, documentId, body]);
  }
}
