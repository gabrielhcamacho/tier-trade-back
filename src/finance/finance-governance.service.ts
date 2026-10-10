import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import type {
  ConfigureFinancePolicyInput, CreateBankAccountInput, CreateBankStatementEntryInput,
  AccrueCommissionInput, CreateCommissionPolicyInput,
  CreatePaymentBatchInput, CreatePurchaseCostComponentInput, ReconcileBankStatementEntryInput,
  ReverseSettlementInput, ImportBankStatementInput,
} from './finance.schemas.js';

@Injectable()
export class FinanceGovernanceService {
  constructor(@Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort) {}

  workspace(tenantId: string, actorId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertMember(client, tenantId, actorId);
      const policies = await client.query(`SELECT id,version,payment_approval_threshold::text,active,created_at
          FROM app.finance_policies WHERE tenant_id=$1 ORDER BY version DESC`, [tenantId]);
      const components = await client.query(`SELECT pcc.id,pcc.financial_event_id,pcc.title_id,pcc.load_receipt_id,
          pcc.component_type,pcc.payable_impact,pcc.amount::text,pcc.description,pcc.external_reference,
          pcc.created_at,pcc.reversed_at,pcc.reversal_reason,ft.title_number
          FROM app.purchase_cost_components pcc
          JOIN app.financial_titles ft ON (ft.tenant_id,ft.id)=(pcc.tenant_id,pcc.title_id)
          WHERE pcc.tenant_id=$1 ORDER BY pcc.created_at DESC,pcc.id DESC`, [tenantId]);
      const batches = await client.query(`SELECT pb.id,pb.reference,pb.scheduled_on::text,pb.status,pb.total_amount::text,
          pb.policy_version,pb.approval_threshold::text,pb.created_by,pb.submitted_at,pb.approved_by,
          pb.approved_at,pb.executed_by,pb.executed_at,
          COALESCE(jsonb_agg(jsonb_build_object('id',pbi.id,'titleId',pbi.title_id,
            'titleNumber',ft.title_number,'amount',pbi.amount::text,'paymentId',pbi.payment_id)
            ORDER BY ft.title_number) FILTER (WHERE pbi.id IS NOT NULL),'[]'::jsonb) AS items
          FROM app.payment_batches pb
          LEFT JOIN app.payment_batch_items pbi ON (pbi.tenant_id,pbi.batch_id)=(pb.tenant_id,pb.id)
          LEFT JOIN app.financial_titles ft ON (ft.tenant_id,ft.id)=(pbi.tenant_id,pbi.title_id)
          WHERE pb.tenant_id=$1 GROUP BY pb.tenant_id,pb.id ORDER BY pb.created_at DESC`, [tenantId]);
      const accounts = await client.query(`SELECT id,code,name,active,created_at FROM app.bank_accounts
          WHERE tenant_id=$1 ORDER BY active DESC,code`, [tenantId]);
      const entries = await client.query(`SELECT bse.id,bse.bank_account_id,ba.code AS bank_account_code,bse.occurred_at,
          bse.direction,bse.amount::text,bse.bank_reference,bse.description,bse.status,
          bse.matched_type,bse.matched_id,bse.matched_at,bse.import_id,bse.source_line_number
          FROM app.bank_statement_entries bse
          JOIN app.bank_accounts ba ON (ba.tenant_id,ba.id)=(bse.tenant_id,bse.bank_account_id)
          WHERE bse.tenant_id=$1 ORDER BY bse.occurred_at DESC,bse.id DESC`, [tenantId]);
      const imports = await client.query(`SELECT bsi.id,bsi.bank_account_id,ba.code AS bank_account_code,
          bsi.source_format,bsi.original_file_name,bsi.content_sha256,bsi.adapter_version,
          bsi.imported_count,bsi.skipped_count,bsi.mapping,bsi.created_at
          FROM app.bank_statement_imports bsi
          JOIN app.bank_accounts ba ON (ba.tenant_id,ba.id)=(bsi.tenant_id,bsi.bank_account_id)
          WHERE bsi.tenant_id=$1 ORDER BY bsi.created_at DESC,bsi.id DESC`, [tenantId]);
      const realized = await this.realizedMargin(client, tenantId);
      const commissionPolicies = await client.query(`SELECT id,code,name,version,status,basis,rate_pct::text,
          commodity,beneficiary_name,effective_from::text,effective_to::text,created_at
          FROM app.commission_policies WHERE tenant_id=$1 ORDER BY code,version DESC`, [tenantId]);
      const commissionAccruals = await client.query(`SELECT ca.id,ca.policy_id,cp.code AS policy_code,
          ca.financial_event_id,ca.basis_amount::text,ca.commission_amount::text,ca.status,
          ca.calculation_snapshot,ca.created_at
          FROM app.commission_accruals ca JOIN app.commission_policies cp
            ON (cp.tenant_id,cp.id)=(ca.tenant_id,ca.policy_id)
          WHERE ca.tenant_id=$1 ORDER BY ca.created_at DESC,ca.id DESC`, [tenantId]);
      return {
        activePolicy: policies.rows.find((row) => row.active) ?? null,
        policies: policies.rows,
        purchaseCostComponents: components.rows,
        paymentBatches: batches.rows,
        bankAccounts: accounts.rows,
        bankStatementEntries: entries.rows,
        bankStatementImports: imports.rows,
        realizedMargin: realized,
        commissionPolicies: commissionPolicies.rows,
        commissionAccruals: commissionAccruals.rows,
      };
    });
  }

  createPurchaseCostComponent(tenantId: string, actorId: string, input: CreatePurchaseCostComponentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const source = await client.query<{ title_id: string; load_receipt_id: string; amount: string }>(
        `SELECT ft.id AS title_id,fe.load_receipt_id,ft.amount::text
          FROM app.financial_events fe JOIN app.financial_titles ft
            ON (ft.tenant_id,ft.financial_event_id)=(fe.tenant_id,fe.id)
          WHERE fe.tenant_id=$1 AND fe.id=$2 AND fe.event_type='PURCHASE_RECEIPT_PAYABLE'
          FOR UPDATE OF ft`, [tenantId, input.financialEventId]);
      if (!source.rows[0]) throw new NotFoundException({ code: 'PURCHASE_PAYABLE_TITLE_NOT_FOUND' });
      const id = randomUUID();
      await client.query(`INSERT INTO app.purchase_cost_components
        (tenant_id,id,financial_event_id,title_id,load_receipt_id,component_type,payable_impact,
         amount,description,external_reference,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [tenantId, id, input.financialEventId, source.rows[0].title_id, source.rows[0].load_receipt_id,
        input.componentType, input.payableImpact, new Decimal(input.amount).toFixed(2),
        input.description, input.externalReference, actorId]);
      if (input.payableImpact !== 'MEMO_ONLY') {
        await client.query(`INSERT INTO app.financial_title_adjustments
          (tenant_id,id,title_id,financial_event_id,purchase_cost_component_id,adjustment_type,
           adjustment_effect,amount,created_by)
          VALUES ($1,$2,$3,$4,$5,'PURCHASE_COST_COMPONENT',$6,$7,$8)`,
        [tenantId, randomUUID(), source.rows[0].title_id, input.financialEventId, id,
          input.payableImpact === 'REDUCE_PAYABLE' ? 'REDUCE' : 'INCREASE',
          new Decimal(input.amount).toFixed(2), actorId]);
        await this.refreshTitleStatus(client, tenantId, source.rows[0].title_id);
      }
      await this.record(client, tenantId, actorId, 'finance.purchase_cost_component_created',
        'purchase_cost_component', id, input);
      return { id, ...input, amount: new Decimal(input.amount).toFixed(2) };
    });
  }

  createCommissionPolicy(tenantId: string, actorId: string, input: CreateCommissionPolicyInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId,
        input.status === 'ACTIVE' ? 'FINANCE_APPROVE' : 'FINANCE_EDIT');
      const versions = await client.query<{ version: number }>(
        `SELECT version FROM app.commission_policies WHERE tenant_id=$1 AND code=$2 FOR UPDATE`,
        [tenantId, input.code]);
      const version = Math.max(0, ...versions.rows.map((row) => row.version)) + 1;
      if (input.status === 'ACTIVE') {
        await client.query(`UPDATE app.commission_policies SET status='RETIRED'
          WHERE tenant_id=$1 AND code=$2 AND status='ACTIVE'`, [tenantId, input.code]);
      }
      const id = randomUUID();
      await client.query(`INSERT INTO app.commission_policies
        (tenant_id,id,code,name,version,status,basis,rate_pct,commodity,beneficiary_name,
         effective_from,effective_to,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [tenantId, id, input.code, input.name, version, input.status, input.basis,
        new Decimal(input.ratePct).toFixed(6), input.commodity, input.beneficiaryName,
        input.effectiveFrom, input.effectiveTo, actorId]);
      await this.record(client, tenantId, actorId, 'finance.commission_policy_created',
        'commission_policy', id, { ...input, version });
      return { id, version, ...input, ratePct: new Decimal(input.ratePct).toFixed(6) };
    });
  }

  accrueCommission(tenantId: string, actorId: string, input: AccrueCommissionInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const source = await client.query<{
        status: string; basis: string; rate_pct: string; effective_from: string;
        effective_to: string | null; expected_on: string | null; amount: string; commodity: string | null;
        policy_commodity: string | null;
      }>(`SELECT cp.status,cp.basis,cp.rate_pct::text,cp.effective_from::text,cp.effective_to::text,
                 fe.expected_on::text,COALESCE(fe.calculated_amount,fe.raw_amount)::text AS amount,
                 COALESCE(sc.commodity,o.commodity) AS commodity,cp.commodity AS policy_commodity
            FROM app.commission_policies cp
            JOIN app.financial_events fe ON fe.tenant_id=cp.tenant_id AND fe.id=$3
            LEFT JOIN app.sales_contracts sc
              ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
            LEFT JOIN app.contracts c ON (c.tenant_id,c.id)=(fe.tenant_id,fe.purchase_contract_id)
            LEFT JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
           WHERE cp.tenant_id=$1 AND cp.id=$2 AND fe.calculation_status='READY'
           FOR UPDATE OF cp,fe`, [tenantId, input.policyId, input.financialEventId]);
      if (!source.rows[0]) throw new NotFoundException({ code: 'COMMISSION_SOURCE_NOT_FOUND' });
      const row = source.rows[0];
      if (row.status !== 'ACTIVE') throw new ConflictException({ code: 'COMMISSION_POLICY_NOT_ACTIVE' });
      if (row.policy_commodity && row.policy_commodity !== row.commodity) {
        throw new ConflictException({ code: 'COMMISSION_POLICY_COMMODITY_MISMATCH' });
      }
      if (!row.expected_on || row.expected_on < row.effective_from
        || (row.effective_to && row.expected_on > row.effective_to)) {
        throw new ConflictException({ code: 'COMMISSION_POLICY_OUTSIDE_EFFECTIVE_PERIOD' });
      }
      const basisAmount = new Decimal(row.amount);
      const exact = basisAmount.mul(row.rate_pct).div(100);
      if (exact.decimalPlaces() > 2) {
        throw new UnprocessableEntityException({
          code: 'COMMISSION_ROUNDING_POLICY_REQUIRED', exactAmount: exact.toString(),
        });
      }
      const commissionAmount = exact.toFixed(2);
      const id = randomUUID();
      const snapshot = { basis: row.basis, basisAmount: basisAmount.toFixed(2),
        ratePct: new Decimal(row.rate_pct).toFixed(6), exactAmount: exact.toString(), rounding: 'NONE_REQUIRED' };
      try {
        await client.query(`INSERT INTO app.commission_accruals
          (tenant_id,id,policy_id,financial_event_id,basis_amount,commission_amount,
           calculation_snapshot,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [tenantId, id, input.policyId, input.financialEventId, basisAmount.toFixed(2),
          commissionAmount, JSON.stringify(snapshot), actorId]);
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
          throw new ConflictException({ code: 'COMMISSION_ALREADY_ACCRUED' });
        }
        throw error;
      }
      await this.record(client, tenantId, actorId, 'finance.commission_accrued',
        'commission_accrual', id, snapshot);
      return { id, ...input, basisAmount: basisAmount.toFixed(2), commissionAmount,
        status: 'ACCRUED', calculationSnapshot: snapshot };
    });
  }

  reversePurchaseCostComponent(tenantId: string, actorId: string, id: string, input: ReverseSettlementInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const row = await client.query<{ title_id: string; reversed_at: Date | null }>(
        'SELECT title_id,reversed_at FROM app.purchase_cost_components WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, id]);
      if (!row.rows[0]) throw new NotFoundException({ code: 'PURCHASE_COST_COMPONENT_NOT_FOUND' });
      if (row.rows[0].reversed_at) throw new ConflictException({ code: 'PURCHASE_COST_COMPONENT_ALREADY_REVERSED' });
      await client.query(`UPDATE app.purchase_cost_components SET reversed_at=now(),reversed_by=$3,reversal_reason=$4
        WHERE tenant_id=$1 AND id=$2`, [tenantId, id, actorId, input.reason]);
      await client.query(`UPDATE app.financial_title_adjustments SET reversed_at=now(),reversed_by=$3,reversal_reason=$4
        WHERE tenant_id=$1 AND purchase_cost_component_id=$2`, [tenantId, id, actorId, input.reason]);
      await this.refreshTitleStatus(client, tenantId, row.rows[0].title_id);
      await this.record(client, tenantId, actorId, 'finance.purchase_cost_component_reversed',
        'purchase_cost_component', id, input);
      return { id, reversed: true };
    });
  }

  configurePolicy(tenantId: string, actorId: string, input: ConfigureFinancePolicyInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_APPROVE');
      const versions = await client.query<{ version: number }>(
        'SELECT version FROM app.finance_policies WHERE tenant_id=$1 FOR UPDATE', [tenantId]);
      const nextVersion = Math.max(0, ...versions.rows.map((row) => row.version)) + 1;
      await client.query('UPDATE app.finance_policies SET active=false WHERE tenant_id=$1 AND active=true', [tenantId]);
      const id = randomUUID();
      await client.query(`INSERT INTO app.finance_policies
        (tenant_id,id,version,payment_approval_threshold,active,created_by) VALUES ($1,$2,$3,$4,true,$5)`,
      [tenantId, id, nextVersion, new Decimal(input.paymentApprovalThreshold).toFixed(2), actorId]);
      await this.record(client, tenantId, actorId, 'finance.policy_configured', 'finance_policy', id, input);
      return { id, version: nextVersion, ...input, active: true };
    });
  }

  createPaymentBatch(tenantId: string, actorId: string, input: CreatePaymentBatchInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const ids = input.items.map((item) => item.titleId);
      const titles = await client.query<{ id: string; direction: string; amount: string; available: string }>(
        `SELECT ft.id,fe.direction,ft.amount::text,
          (ft.amount + COALESCE(adj.increases,0) - COALESCE(adj.reductions,0) - COALESCE(pay.paid,0))::text AS available
          FROM app.financial_titles ft JOIN app.financial_events fe
            ON (fe.tenant_id,fe.id)=(ft.tenant_id,ft.financial_event_id)
          LEFT JOIN LATERAL (SELECT
            COALESCE(sum(amount) FILTER (WHERE adjustment_effect='INCREASE' AND reversed_at IS NULL),0) increases,
            COALESCE(sum(amount) FILTER (WHERE adjustment_effect='REDUCE' AND reversed_at IS NULL),0) reductions
            FROM app.financial_title_adjustments WHERE tenant_id=ft.tenant_id AND title_id=ft.id) adj ON true
          LEFT JOIN LATERAL (SELECT COALESCE(sum(amount) FILTER (WHERE reversed_at IS NULL),0) paid
            FROM app.financial_payments WHERE tenant_id=ft.tenant_id AND title_id=ft.id) pay ON true
          WHERE ft.tenant_id=$1 AND ft.id=ANY($2::uuid[]) FOR UPDATE OF ft`, [tenantId, ids]);
      if (titles.rowCount !== ids.length || titles.rows.some((row) => row.direction !== 'OUTFLOW')) {
        throw new ConflictException({ code: 'PAYMENT_BATCH_REQUIRES_PAYABLE_TITLES' });
      }
      for (const item of input.items) {
        const title = titles.rows.find((row) => row.id === item.titleId)!;
        if (new Decimal(item.amount).greaterThan(title.available)) {
          throw new UnprocessableEntityException({ code: 'PAYMENT_BATCH_ITEM_EXCEEDS_BALANCE', titleId: item.titleId, outstandingAmount: title.available });
        }
      }
      const id = randomUUID();
      const total = input.items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
      await client.query(`INSERT INTO app.payment_batches
        (tenant_id,id,reference,scheduled_on,total_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, id, input.reference, input.scheduledOn, total.toFixed(2), actorId]);
      for (const item of input.items) await client.query(`INSERT INTO app.payment_batch_items
        (tenant_id,id,batch_id,title_id,amount) VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, randomUUID(), id, item.titleId, new Decimal(item.amount).toFixed(2)]);
      await this.record(client, tenantId, actorId, 'finance.payment_batch_created', 'payment_batch', id, input);
      return { id, status: 'DRAFT', totalAmount: total.toFixed(2), ...input };
    });
  }

  submitPaymentBatch(tenantId: string, actorId: string, id: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const batch = await client.query<{ status: string; total_amount: string }>(
        'SELECT status,total_amount::text FROM app.payment_batches WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, id]);
      if (!batch.rows[0]) throw new NotFoundException({ code: 'PAYMENT_BATCH_NOT_FOUND' });
      if (batch.rows[0].status !== 'DRAFT') throw new ConflictException({ code: 'PAYMENT_BATCH_NOT_DRAFT' });
      const policy = await client.query<{ version: number; threshold: string }>(
        `SELECT version,payment_approval_threshold::text AS threshold FROM app.finance_policies
          WHERE tenant_id=$1 AND active=true`, [tenantId]);
      if (!policy.rows[0]) throw new ConflictException({ code: 'FINANCE_POLICY_REQUIRED' });
      const requiresApproval = new Decimal(batch.rows[0].total_amount).greaterThan(policy.rows[0].threshold);
      const status = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';
      await client.query(`UPDATE app.payment_batches SET status=$3,submitted_at=now(),policy_version=$4,
        approval_threshold=$5,approved_by=CASE WHEN $3='APPROVED' THEN $6::uuid ELSE NULL END,
        approved_at=CASE WHEN $3='APPROVED' THEN now() ELSE NULL END WHERE tenant_id=$1 AND id=$2`,
      [tenantId, id, status, policy.rows[0].version, policy.rows[0].threshold, actorId]);
      await this.record(client, tenantId, actorId, 'finance.payment_batch_submitted', 'payment_batch', id, { status });
      return { id, status, requiresApproval };
    });
  }

  approvePaymentBatch(tenantId: string, actorId: string, id: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_APPROVE');
      const batch = await client.query<{ status: string; created_by: string }>(
        'SELECT status,created_by FROM app.payment_batches WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, id]);
      if (!batch.rows[0]) throw new NotFoundException({ code: 'PAYMENT_BATCH_NOT_FOUND' });
      if (batch.rows[0].status !== 'PENDING_APPROVAL') throw new ConflictException({ code: 'PAYMENT_BATCH_NOT_PENDING_APPROVAL' });
      if (batch.rows[0].created_by === actorId) throw new ConflictException({ code: 'FOUR_EYES_APPROVER_REQUIRED' });
      await client.query(`UPDATE app.payment_batches SET status='APPROVED',approved_by=$3,approved_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, id, actorId]);
      await this.record(client, tenantId, actorId, 'finance.payment_batch_approved', 'payment_batch', id, {});
      return { id, status: 'APPROVED' };
    });
  }

  executePaymentBatch(tenantId: string, actorId: string, id: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const batch = await client.query<{ status: string; reference: string }>(
        'SELECT status,reference FROM app.payment_batches WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, id]);
      if (!batch.rows[0]) throw new NotFoundException({ code: 'PAYMENT_BATCH_NOT_FOUND' });
      if (batch.rows[0].status !== 'APPROVED') throw new ConflictException({ code: 'PAYMENT_BATCH_NOT_APPROVED' });
      const items = await client.query<{ id: string; title_id: string; amount: string; fiscal_obligation_id: string | null; load_receipt_id: string | null }>(
        `SELECT pbi.id,pbi.title_id,pbi.amount::text,fe.fiscal_obligation_id,fe.load_receipt_id
          FROM app.payment_batch_items pbi JOIN app.financial_titles ft
            ON (ft.tenant_id,ft.id)=(pbi.tenant_id,pbi.title_id)
          JOIN app.financial_events fe ON (fe.tenant_id,fe.id)=(ft.tenant_id,ft.financial_event_id)
          WHERE pbi.tenant_id=$1 AND pbi.batch_id=$2 AND pbi.payment_id IS NULL`, [tenantId, id]);
      for (const [index, item] of items.rows.entries()) {
        const paymentId = randomUUID();
        await client.query(`INSERT INTO app.financial_payments
          (tenant_id,id,title_id,fiscal_obligation_id,purchase_receipt_id,amount,paid_at,bank_reference,notes,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9)`,
        [tenantId, paymentId, item.title_id, item.fiscal_obligation_id, item.load_receipt_id,
          item.amount, `${batch.rows[0].reference}-${index + 1}`, `Lote ${batch.rows[0].reference}`, actorId]);
        await client.query('UPDATE app.payment_batch_items SET payment_id=$3 WHERE tenant_id=$1 AND id=$2', [tenantId, item.id, paymentId]);
        await this.refreshTitleStatus(client, tenantId, item.title_id);
      }
      await client.query(`UPDATE app.payment_batches SET status='EXECUTED',executed_by=$3,executed_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, id, actorId]);
      await this.record(client, tenantId, actorId, 'finance.payment_batch_executed', 'payment_batch', id, {});
      return { id, status: 'EXECUTED', paymentCount: items.rowCount };
    });
  }

  createBankAccount(tenantId: string, actorId: string, input: CreateBankAccountInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const id = randomUUID();
      await client.query(`INSERT INTO app.bank_accounts (tenant_id,id,code,name,created_by)
        VALUES ($1,$2,$3,$4,$5)`, [tenantId, id, input.code, input.name, actorId]);
      await this.record(client, tenantId, actorId, 'finance.bank_account_created', 'bank_account', id, input);
      return { id, ...input, active: true };
    });
  }

  createBankStatementEntry(tenantId: string, actorId: string, input: CreateBankStatementEntryInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const id = randomUUID();
      await client.query(`INSERT INTO app.bank_statement_entries
        (tenant_id,id,bank_account_id,occurred_at,direction,amount,bank_reference,description,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [tenantId, id, input.bankAccountId, input.occurredAt,
        input.direction, new Decimal(input.amount).toFixed(2), input.bankReference, input.description, actorId]);
      await this.record(client, tenantId, actorId, 'finance.bank_statement_imported', 'bank_statement_entry', id, input);
      return { id, ...input, status: 'UNMATCHED' };
    });
  }

  importBankStatement(tenantId: string, actorId: string, input: ImportBankStatementInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      if (!['TIER_TRADE_CSV', 'NORMALIZED_JSON'].includes(input.sourceFormat)) {
        throw new UnprocessableEntityException({ code: 'BANK_STATEMENT_ADAPTER_NOT_AVAILABLE', sourceFormat: input.sourceFormat });
      }
      const account = await client.query('SELECT 1 FROM app.bank_accounts WHERE tenant_id=$1 AND id=$2 AND active=true FOR UPDATE', [tenantId, input.bankAccountId]);
      if (!account.rows[0]) throw new NotFoundException({ code: 'ACTIVE_BANK_ACCOUNT_NOT_FOUND' });
      const normalized = input.entries.map((entry) => ({
        ...entry,
        amount: new Decimal(entry.amount).toFixed(2),
        bankReference: entry.bankReference.trim(),
        description: entry.description?.trim() ?? null,
      }));
      const contentSha256 = createHash('sha256').update(JSON.stringify({
        sourceFormat: input.sourceFormat, entries: normalized,
      })).digest('hex');
      const existing = await client.query<{ id: string; imported_count: number; skipped_count: number }>(
        `SELECT id,imported_count,skipped_count FROM app.bank_statement_imports
          WHERE tenant_id=$1 AND bank_account_id=$2 AND content_sha256=$3`,
        [tenantId, input.bankAccountId, contentSha256]);
      if (existing.rows[0]) return { id: existing.rows[0].id, contentSha256,
        importedCount: existing.rows[0].imported_count, skippedCount: existing.rows[0].skipped_count,
        alreadyImported: true };

      const importId = randomUUID();
      await client.query(`INSERT INTO app.bank_statement_imports
        (tenant_id,id,bank_account_id,source_format,original_file_name,content_sha256,adapter_version,
         imported_count,skipped_count,mapping,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$8::jsonb,$9)`,
      [tenantId, importId, input.bankAccountId, input.sourceFormat, input.originalFileName,
        contentSha256, input.adapterVersion, JSON.stringify(input.mapping), actorId]);
      let importedCount = 0;
      for (const entry of normalized) {
        const fingerprint = createHash('sha256').update([
          input.bankAccountId, entry.occurredAt, entry.direction, entry.amount, entry.bankReference,
        ].join('|')).digest('hex');
        const inserted = await client.query(`INSERT INTO app.bank_statement_entries
          (tenant_id,id,bank_account_id,occurred_at,direction,amount,bank_reference,description,created_by,
           import_id,source_line_number,fingerprint)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT DO NOTHING RETURNING id`,
        [tenantId, randomUUID(), input.bankAccountId, entry.occurredAt, entry.direction, entry.amount,
          entry.bankReference, entry.description, actorId, importId, entry.sourceLineNumber, fingerprint]);
        importedCount += inserted.rowCount ?? 0;
      }
      const skippedCount = normalized.length - importedCount;
      await client.query(`UPDATE app.bank_statement_imports SET imported_count=$3,skipped_count=$4
        WHERE tenant_id=$1 AND id=$2`, [tenantId, importId, importedCount, skippedCount]);
      await this.record(client, tenantId, actorId, 'finance.bank_statement_batch_imported',
        'bank_statement_import', importId, { sourceFormat: input.sourceFormat, originalFileName: input.originalFileName,
          contentSha256, importedCount, skippedCount, adapterVersion: input.adapterVersion });
      return { id: importId, contentSha256, importedCount, skippedCount, alreadyImported: false };
    });
  }

  reconcileBankStatementEntry(tenantId: string, actorId: string, id: string, input: ReconcileBankStatementEntryInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const entry = await client.query<{ direction: string; amount: string; status: string }>(
        `SELECT direction,amount::text,status FROM app.bank_statement_entries
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, id]);
      if (!entry.rows[0]) throw new NotFoundException({ code: 'BANK_STATEMENT_ENTRY_NOT_FOUND' });
      if (entry.rows[0].status !== 'UNMATCHED') throw new ConflictException({ code: 'BANK_STATEMENT_ENTRY_ALREADY_MATCHED' });
      const isSettlement = input.matchedType === 'SETTLEMENT';
      const movement = await client.query<{ amount: string; reversed_at: Date | null; bank_statement_entry_id: string | null }>(
        `SELECT amount::text,reversed_at,bank_statement_entry_id FROM app.${isSettlement ? 'financial_settlements' : 'financial_payments'}
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, input.matchedId]);
      if (!movement.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_MOVEMENT_NOT_FOUND' });
      if (movement.rows[0].reversed_at || movement.rows[0].bank_statement_entry_id) throw new ConflictException({ code: 'FINANCIAL_MOVEMENT_NOT_RECONCILABLE' });
      const expectedDirection = isSettlement ? 'CREDIT' : 'DEBIT';
      if (entry.rows[0].direction !== expectedDirection || !new Decimal(entry.rows[0].amount).equals(movement.rows[0].amount)) {
        throw new UnprocessableEntityException({ code: 'BANK_RECONCILIATION_MISMATCH' });
      }
      await client.query(`UPDATE app.${isSettlement ? 'financial_settlements' : 'financial_payments'}
        SET bank_statement_entry_id=$3 WHERE tenant_id=$1 AND id=$2`, [tenantId, input.matchedId, id]);
      await client.query(`UPDATE app.bank_statement_entries SET status='MATCHED',matched_type=$3,matched_id=$4,
        matched_by=$5,matched_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, input.matchedType, input.matchedId, actorId]);
      await this.record(client, tenantId, actorId, 'finance.bank_statement_reconciled', 'bank_statement_entry', id, input);
      return { id, status: 'MATCHED', ...input };
    });
  }

  private async realizedMargin(client: PoolClient, tenantId: string) {
    const calculationScope = {
      basis: 'OPERATIONAL_REALIZED_MARGIN_V1',
      included: [
        'SALE_DISPATCH_REVENUE',
        'ALLOCATED_PURCHASE_ACQUISITION_COST',
        'ACTIVE_PURCHASE_COST_COMPONENTS',
      ],
      excluded: [
        'SALE_TAXES_AND_EXPENSES',
        'COMMISSION_ACCRUALS',
        'ADMINISTRATIVE_EXPENSES',
        'ACCOUNTING_ENTRIES_AND_CLOSING',
      ],
      accountingResult: false,
    } as const;
    const rows = await client.query<{ commodity: string; revenue: string; acquisition_cost: string; components: string; dispatched_kg: string }>(
      `SELECT il.commodity,
        sum(sfe.calculated_amount)::text AS revenue,
        sum((d.quantity_kg / NULLIF(pfe.quantity_kg,0)) * pfe.calculated_amount)::text AS acquisition_cost,
        sum((d.quantity_kg / NULLIF(pfe.quantity_kg,0)) * COALESCE(comp.net_component,0))::text AS components,
        sum(d.quantity_kg)::text AS dispatched_kg
      FROM app.inventory_dispatches d
      JOIN app.financial_events sfe ON sfe.tenant_id=d.tenant_id AND sfe.inventory_dispatch_id=d.id
        AND sfe.event_type='SALE_DISPATCH_RECEIVABLE' AND sfe.calculation_status='READY'
      JOIN app.inventory_allocations ia ON (ia.tenant_id,ia.id)=(d.tenant_id,d.allocation_id)
      JOIN app.inventory_lots il ON (il.tenant_id,il.id)=(ia.tenant_id,ia.lot_id)
      JOIN app.loads l ON (l.tenant_id,l.id)=(il.tenant_id,il.source_load_id)
      JOIN app.contracts c ON (c.tenant_id,c.id)=(l.tenant_id,l.contract_id)
      JOIN app.financial_events pfe ON pfe.tenant_id=l.tenant_id AND pfe.load_id=l.id
        AND pfe.event_type='PURCHASE_RECEIPT_PAYABLE' AND pfe.calculation_status='READY'
      LEFT JOIN LATERAL (SELECT COALESCE(sum(CASE payable_impact WHEN 'INCREASE_PAYABLE' THEN amount
        WHEN 'REDUCE_PAYABLE' THEN -amount ELSE 0 END) FILTER (WHERE reversed_at IS NULL),0) net_component
        FROM app.purchase_cost_components WHERE tenant_id=pfe.tenant_id AND financial_event_id=pfe.id) comp ON true
      WHERE d.tenant_id=$1 GROUP BY il.commodity ORDER BY il.commodity`, [tenantId]);
    const byCommodity = rows.rows.map((row) => {
      const cost = new Decimal(row.acquisition_cost).plus(row.components);
      return { commodity: row.commodity, revenueAmount: new Decimal(row.revenue).toFixed(2),
        acquisitionCostAmount: new Decimal(row.acquisition_cost).toFixed(2),
        componentImpactAmount: new Decimal(row.components).toFixed(2), totalCostAmount: cost.toFixed(2),
        realizedMarginAmount: new Decimal(row.revenue).minus(cost).toFixed(2), dispatchedKg: row.dispatched_kg };
    });
    const total = byCommodity.reduce((acc, row) => ({
      revenue: acc.revenue.plus(row.revenueAmount), cost: acc.cost.plus(row.totalCostAmount),
    }), { revenue: new Decimal(0), cost: new Decimal(0) });
    return { status: byCommodity.length ? 'COMPLETE' : 'NO_DATA', revenueAmount: total.revenue.toFixed(2),
      totalCostAmount: total.cost.toFixed(2), realizedMarginAmount: total.revenue.minus(total.cost).toFixed(2),
      calculationScope, byCommodity };
  }

  private async refreshTitleStatus(client: PoolClient, tenantId: string, titleId: string) {
    const row = await client.query<{ amount: string; realized: string; increases: string; reductions: string }>(
      `SELECT ft.amount::text,
        (COALESCE((SELECT sum(amount) FROM app.financial_settlements WHERE tenant_id=$1 AND title_id=$2 AND reversed_at IS NULL),0)
         + COALESCE((SELECT sum(amount) FROM app.financial_payments WHERE tenant_id=$1 AND title_id=$2 AND reversed_at IS NULL),0))::text realized,
        COALESCE((SELECT sum(amount) FROM app.financial_title_adjustments WHERE tenant_id=$1 AND title_id=$2 AND adjustment_effect='INCREASE' AND reversed_at IS NULL),0)::text increases,
        COALESCE((SELECT sum(amount) FROM app.financial_title_adjustments WHERE tenant_id=$1 AND title_id=$2 AND adjustment_effect='REDUCE' AND reversed_at IS NULL),0)::text reductions
        FROM app.financial_titles ft WHERE tenant_id=$1 AND id=$2`, [tenantId, titleId]);
    const target = new Decimal(row.rows[0]!.amount).plus(row.rows[0]!.increases).minus(row.rows[0]!.reductions);
    const realized = new Decimal(row.rows[0]!.realized);
    const status = realized.isZero() && target.greaterThan(0) ? 'OPEN' : realized.greaterThanOrEqualTo(target) ? 'SETTLED' : 'PARTIALLY_SETTLED';
    await client.query('UPDATE app.financial_titles SET status=$3 WHERE tenant_id=$1 AND id=$2', [tenantId, titleId, status]);
  }

  private async assertMember(client: PoolClient, tenantId: string, actorId: string) {
    const result = await client.query('SELECT 1 FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true', [tenantId, actorId]);
    if (result.rowCount !== 1) throw new NotFoundException({ code: 'ACTIVE_MEMBERSHIP_NOT_FOUND' });
  }

  private async assertCapability(client: PoolClient, tenantId: string, actorId: string, capability: string) {
    const result = await client.query<{ capabilities: string[] }>('SELECT capabilities FROM app.memberships WHERE tenant_id=$1 AND user_id=$2 AND active=true', [tenantId, actorId]);
    if (!result.rows[0] || !result.rows[0].capabilities.includes(capability)) throw new NotFoundException({ code: 'CAPABILITY_NOT_FOUND' });
  }

  private async record(client: PoolClient, tenantId: string, actorId: string, eventType: string,
    aggregateType: string, aggregateId: string, payload: unknown) {
    const id = randomUUID(); const body = JSON.stringify(payload);
    await client.query(`INSERT INTO app.audit_events
      (tenant_id,id,actor_id,event_type,aggregate_type,aggregate_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [tenantId, id, actorId, eventType, aggregateType, aggregateId, body]);
    await client.query(`INSERT INTO app.outbox_events
      (tenant_id,id,event_type,aggregate_type,aggregate_id,payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [tenantId, id, eventType, aggregateType, aggregateId, body]);
  }
}
