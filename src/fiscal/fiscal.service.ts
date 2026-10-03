import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabasePlatformPort } from '../database/database.js';
import { FinancialProjectionPort } from '../finance/finance.port.js';
import type {
  AcceptFiscalCalculationInput, CreateFiscalAuthorityInput, CreateFiscalCalculationInput,
  CreateFiscalConfigurationInput, CreateFiscalDocumentInput, CreateFiscalEstablishmentInput,
  RejectFiscalDocumentInput, UpdateFiscalConfigurationInput, UpdateFiscalDocumentInput,
} from './fiscal.schemas.js';
import { taxComponentSchema } from './fiscal.schemas.js';
import { calculateFiscalMemory, type FiscalCalculationComponent } from './fiscal-calculation.js';

type FiscalDocumentRow = {
  id: string; financial_event_id: string; source_id: string; sales_contract_id: string;
  contract_reference: string; counterparty_name: string; dispatch_reference: string;
  document_number: string; access_key: string | null; issued_at: Date; total_amount: string;
  expected_amount: string | null; status: string; validation_notes: string | null;
  rejection_reason: string | null; updated_at: Date; validated_at: Date | null;
  title_id: string | null; title_number: string | null; title_status: string | null;
};

type FiscalEstablishmentRow = {
  id: string; legal_name: string; tax_id: string; state_registration: string | null;
  uf: string; tax_regime: string | null; active: boolean; updated_at: Date;
};

type FiscalConfigurationRow = {
  id: string; configuration_key: string; version: number; establishment_id: string | null;
  establishment_name: string | null; establishment_uf: string | null; tax_regime: string | null;
  establishment_active: boolean | null;
  name: string; operation_type: string; commodity: string | null; destination_uf: string | null;
  cfop: string | null; emission_strategy: string | null; technical_responsible: string | null;
  effective_from: string | null; effective_to: string | null; tax_components: unknown;
  rounding_mode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP' | null; rounding_scale: number | null;
  status: string; updated_at: Date; activated_at: Date | null;
};

type FiscalCalculationRow = {
  id: string; request_key: string; configuration_id: string; configuration_key: string;
  configuration_version: number; configuration_name: string; establishment_id: string;
  establishment_name: string; operation_type: string; commodity: string; destination_uf: string;
  occurred_on: string; source_type: string; source_id: string | null; currency: string;
  gross_amount: string; tax_total: string; retained_total: string; net_amount: string;
  input_snapshot: unknown; result_snapshot: unknown; calculated_by: string; calculated_at: Date;
  status: 'CALCULATED' | 'ACCEPTED'; acceptance_request_key: string | null;
  acceptance_snapshot: unknown | null; accepted_by: string | null; accepted_at: Date | null;
};

type FiscalAuthorityRow = {
  id: string; legal_name: string; tax_id: string | null;
  jurisdiction: 'FEDERAL' | 'STATE' | 'MUNICIPAL'; uf: string | null;
  active: boolean; updated_at: Date;
};

type FiscalObligationRow = {
  id: string; calculation_id: string; component_tax: string; authority_id: string;
  authority_name: string; competence_date: string; due_date: string; amount: string;
  currency: string; retained: boolean; title_effect: string; payment_responsibility: string;
  status: string; created_at: Date; payable_event_id: string | null; payable_title_id: string | null;
  payable_title_number: string | null; adjustment_id: string | null; adjusted_title_id: string | null;
};

@Injectable()
export class FiscalService {
  constructor(
    @Inject(DatabasePlatformPort) private readonly db: DatabasePlatformPort,
    @Inject(FinancialProjectionPort) private readonly finance: FinancialProjectionPort,
  ) {}

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
      const establishments = await client.query<FiscalEstablishmentRow>(
        `SELECT id,legal_name,tax_id,state_registration,uf,tax_regime,active,updated_at
           FROM app.fiscal_establishments WHERE tenant_id=$1
          ORDER BY active DESC,legal_name,id`, [tenantId]);
      const configurations = await client.query<FiscalConfigurationRow>(
        `SELECT fc.id,fc.configuration_key,fc.version,fc.establishment_id,
                fe.legal_name AS establishment_name,fe.uf AS establishment_uf,fe.tax_regime,
                fe.active AS establishment_active,
                fc.name,fc.operation_type,fc.commodity,fc.destination_uf,fc.cfop,
                fc.emission_strategy,fc.technical_responsible,fc.effective_from::text,
                fc.effective_to::text,fc.rounding_mode,fc.rounding_scale,
                fc.tax_components,fc.status,fc.updated_at,fc.activated_at
           FROM app.fiscal_configuration_versions fc
           LEFT JOIN app.fiscal_establishments fe
             ON (fe.tenant_id,fe.id)=(fc.tenant_id,fc.establishment_id)
          WHERE fc.tenant_id=$1 ORDER BY fc.configuration_key,fc.version DESC`, [tenantId]);
      const calculations = await client.query<FiscalCalculationRow>(
        `SELECT c.id,c.request_key,c.configuration_id,c.configuration_key,c.configuration_version,
                fc.name AS configuration_name,c.establishment_id,fe.legal_name AS establishment_name,
                c.operation_type,c.commodity,c.destination_uf,c.occurred_on::text,c.source_type,
                c.source_id,c.currency,c.gross_amount::text,c.tax_total::text,c.retained_total::text,
                c.net_amount::text,c.input_snapshot,c.result_snapshot,c.calculated_by,c.calculated_at,
                c.status,c.acceptance_request_key,c.acceptance_snapshot,c.accepted_by,c.accepted_at
           FROM app.fiscal_calculations c
           JOIN app.fiscal_configuration_versions fc
             ON (fc.tenant_id,fc.id)=(c.tenant_id,c.configuration_id)
           JOIN app.fiscal_establishments fe
             ON (fe.tenant_id,fe.id)=(c.tenant_id,c.establishment_id)
          WHERE c.tenant_id=$1 ORDER BY c.calculated_at DESC,c.id DESC LIMIT 20`, [tenantId]);
      const authorities = await client.query<FiscalAuthorityRow>(
        `SELECT id,legal_name,tax_id,jurisdiction,uf,active,updated_at
           FROM app.fiscal_authorities
          WHERE tenant_id=$1 ORDER BY active DESC,jurisdiction,legal_name,id`, [tenantId]);
      const obligations = await client.query<FiscalObligationRow>(
        `SELECT fo.id,fo.calculation_id,fo.component_tax,fo.authority_id,
                fa.legal_name AS authority_name,fo.competence_date::text,fo.due_date::text,
                fo.amount::text,fo.currency,fo.retained,fo.title_effect,
                fo.payment_responsibility,fo.status,fo.created_at,
                pfe.id AS payable_event_id,pft.id AS payable_title_id,
                pft.title_number AS payable_title_number,fta.id AS adjustment_id,
                fta.title_id AS adjusted_title_id
           FROM app.fiscal_obligations fo
           JOIN app.fiscal_authorities fa
             ON (fa.tenant_id,fa.id)=(fo.tenant_id,fo.authority_id)
           LEFT JOIN app.financial_events pfe
             ON (pfe.tenant_id,pfe.fiscal_obligation_id)=(fo.tenant_id,fo.id)
           LEFT JOIN app.financial_titles pft
             ON (pft.tenant_id,pft.financial_event_id)=(pfe.tenant_id,pfe.id)
           LEFT JOIN app.financial_title_adjustments fta
             ON (fta.tenant_id,fta.fiscal_obligation_id)=(fo.tenant_id,fo.id)
          WHERE fo.tenant_id=$1 ORDER BY fo.due_date,fo.created_at,fo.id`, [tenantId]);
      const calculationSources = await client.query<{
        id: string; reference: string; beneficiary_name: string; calculated_amount: string;
      }>(
        `SELECT fe.id,COALESCE(sc.reference,d.document_reference,fe.id::text) AS reference,
                COALESCE(cp.legal_name,fa.legal_name) AS beneficiary_name,
                fe.calculated_amount::text
           FROM app.financial_events fe
           LEFT JOIN app.sales_contracts sc
             ON (sc.tenant_id,sc.id)=(fe.tenant_id,fe.sales_contract_id)
           LEFT JOIN app.counterparties cp
             ON (cp.tenant_id,cp.id)=(fe.tenant_id,fe.counterparty_id)
           LEFT JOIN app.fiscal_authorities fa
             ON (fa.tenant_id,fa.id)=(fe.tenant_id,fe.fiscal_authority_id)
           LEFT JOIN app.inventory_dispatches d
             ON (d.tenant_id,d.id)=(fe.tenant_id,fe.inventory_dispatch_id)
          WHERE fe.tenant_id=$1 AND fe.calculation_status='READY'
            AND fe.direction='INFLOW' AND fe.calculated_amount IS NOT NULL
          ORDER BY fe.created_at DESC,fe.id DESC`, [tenantId]);
      const mapped = documents.rows.map((row) => this.mapDocument(row));
      const mappedConfigurations = configurations.rows.map((row) => this.mapConfiguration(row));
      const activeConfigurations = mappedConfigurations.filter((configuration) => configuration.status === 'ACTIVE');
      const blockers = this.configurationBlockers(establishments.rows, activeConfigurations.length);
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
          openObligations: obligations.rows.filter((obligation) => obligation.status === 'OPEN').length,
          taxPayables: obligations.rows.filter((obligation) => obligation.payable_title_id !== null).length,
        },
        documents: mapped,
        establishments: establishments.rows.map((row) => ({
          id: row.id, legalName: row.legal_name, taxId: row.tax_id,
          stateRegistration: row.state_registration, uf: row.uf, taxRegime: row.tax_regime,
          active: row.active, updatedAt: row.updated_at.toISOString(),
        })),
        configurations: mappedConfigurations,
        calculations: calculations.rows.map((row) => this.mapCalculation(row)),
        authorities: authorities.rows.map((row) => ({
          id: row.id, legalName: row.legal_name, taxId: row.tax_id,
          jurisdiction: row.jurisdiction, uf: row.uf, active: row.active,
          updatedAt: row.updated_at.toISOString(),
        })),
        obligations: obligations.rows.map((row) => ({
          id: row.id, calculationId: row.calculation_id, tax: row.component_tax,
          authority: { id: row.authority_id, name: row.authority_name },
          competenceDate: row.competence_date, dueDate: row.due_date, amount: row.amount,
          currency: row.currency, retained: row.retained, titleEffect: row.title_effect,
          paymentResponsibility: row.payment_responsibility, status: row.status,
          createdAt: row.created_at.toISOString(),
          payable: row.payable_event_id ? {
            eventId: row.payable_event_id, titleId: row.payable_title_id,
            titleNumber: row.payable_title_number,
          } : null,
          titleAdjustment: row.adjustment_id ? {
            id: row.adjustment_id, titleId: row.adjusted_title_id,
          } : null,
        })),
        eligibleEvents: eligible.rows.map((row) => ({
          id: row.id, sourceId: row.source_id, salesContractId: row.sales_contract_id,
          contractReference: row.contract_reference, counterpartyName: row.counterparty_name,
          dispatchReference: row.dispatch_reference, expectedAmount: row.calculated_amount,
          calculationStatus: row.calculation_status,
        })),
        calculationSources: calculationSources.rows.map((row) => ({
          id: row.id, reference: row.reference, beneficiaryName: row.beneficiary_name,
          amount: row.calculated_amount,
        })),
        taxCalculation: {
          status: activeConfigurations.length ? 'READY' : 'BLOCKED_CONFIGURATION',
          activeConfigurationCount: activeConfigurations.length,
          blockers: activeConfigurations.length
            ? []
            : blockers,
        },
      };
    });
  }

  createEstablishment(tenantId: string, actorId: string, input: CreateFiscalEstablishmentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.fiscal_establishments
            (tenant_id,id,legal_name,tax_id,state_registration,uf,tax_regime,created_by,updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
          [tenantId, id, input.legalName, input.taxId, input.stateRegistration,
            input.uf, input.taxRegime, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'FISCAL_ESTABLISHMENT_ALREADY_EXISTS' });
        throw error;
      }
      await this.record(client, tenantId, actorId, 'fiscal.establishment_created', 'fiscal_establishment', id,
        { taxId: input.taxId, uf: input.uf, taxRegime: input.taxRegime });
      return { id };
    });
  }

  updateEstablishment(tenantId: string, actorId: string, establishmentId: string,
    input: CreateFiscalEstablishmentInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const existing = await client.query(
        'SELECT 1 FROM app.fiscal_establishments WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, establishmentId]);
      if (!existing.rowCount) throw new NotFoundException({ code: 'FISCAL_ESTABLISHMENT_NOT_FOUND' });
      try {
        await client.query(
          `UPDATE app.fiscal_establishments
              SET legal_name=$3,tax_id=$4,state_registration=$5,uf=$6,tax_regime=$7,
                  updated_by=$8,updated_at=now()
            WHERE tenant_id=$1 AND id=$2`,
          [tenantId, establishmentId, input.legalName, input.taxId, input.stateRegistration,
            input.uf, input.taxRegime, actorId]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException({ code: 'FISCAL_ESTABLISHMENT_ALREADY_EXISTS' });
        throw error;
      }
      await this.record(client, tenantId, actorId, 'fiscal.establishment_updated',
        'fiscal_establishment', establishmentId,
        { taxId: input.taxId, uf: input.uf, taxRegime: input.taxRegime });
      return { id: establishmentId };
    });
  }

  createAuthority(tenantId: string, actorId: string, input: CreateFiscalAuthorityInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const id = randomUUID();
      try {
        await client.query(
          `INSERT INTO app.fiscal_authorities
            (tenant_id,id,legal_name,tax_id,jurisdiction,uf,created_by,updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [tenantId, id, input.legalName, input.taxId, input.jurisdiction, input.uf, actorId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({ code: 'FISCAL_AUTHORITY_ALREADY_EXISTS' });
        }
        throw error;
      }
      await this.record(client, tenantId, actorId, 'fiscal.authority_created',
        'fiscal_authority', id, input);
      return { id, active: true, ...input };
    });
  }

  createConfiguration(tenantId: string, actorId: string, input: CreateFiscalConfigurationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      await this.assertEstablishment(client, tenantId, input.establishmentId);
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.fiscal_configuration_versions
          (tenant_id,id,configuration_key,version,establishment_id,name,commodity,destination_uf,
           cfop,emission_strategy,technical_responsible,effective_from,effective_to,tax_components,
           rounding_mode,rounding_scale,created_by,updated_by)
         VALUES ($1,$2,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$15)`,
        [tenantId, id, input.establishmentId, input.name, input.commodity, input.destinationUf,
          input.cfop, input.emissionStrategy, input.technicalResponsible, input.effectiveFrom,
          input.effectiveTo, JSON.stringify(input.taxComponents), input.roundingMode,
          input.roundingScale, actorId]);
      await this.record(client, tenantId, actorId, 'fiscal.configuration_drafted', 'fiscal_configuration', id,
        { configurationKey: id, version: 1 });
      return { id, configurationKey: id, version: 1, status: 'DRAFT' };
    });
  }

  updateConfiguration(tenantId: string, actorId: string, configurationId: string,
    input: UpdateFiscalConfigurationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const existing = await this.lockConfiguration(client, tenantId, configurationId);
      if (existing.status !== 'DRAFT') throw new ConflictException({ code: 'FISCAL_CONFIGURATION_IMMUTABLE' });
      await this.assertEstablishment(client, tenantId, input.establishmentId);
      await client.query(
        `UPDATE app.fiscal_configuration_versions
            SET establishment_id=$3,name=$4,commodity=$5,destination_uf=$6,cfop=$7,
                emission_strategy=$8,technical_responsible=$9,effective_from=$10,effective_to=$11,
                tax_components=$12::jsonb,rounding_mode=$13,rounding_scale=$14,
                updated_by=$15,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [tenantId, configurationId, input.establishmentId, input.name, input.commodity,
          input.destinationUf, input.cfop, input.emissionStrategy, input.technicalResponsible,
          input.effectiveFrom, input.effectiveTo, JSON.stringify(input.taxComponents),
          input.roundingMode, input.roundingScale, actorId]);
      await this.record(client, tenantId, actorId, 'fiscal.configuration_updated', 'fiscal_configuration',
        configurationId, { configurationKey: existing.configuration_key, version: existing.version });
      return { id: configurationId, status: 'DRAFT' };
    });
  }

  activateConfiguration(tenantId: string, actorId: string, configurationId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const configuration = await this.lockConfiguration(client, tenantId, configurationId);
      if (configuration.status !== 'DRAFT') throw new ConflictException({ code: 'FISCAL_CONFIGURATION_IMMUTABLE' });
      const fields = this.missingActivationFields(configuration);
      if (fields.length) {
        throw new UnprocessableEntityException({ code: 'FISCAL_CONFIGURATION_INCOMPLETE', fields });
      }
      const overlap = await client.query(
        `SELECT 1 FROM app.fiscal_configuration_versions
          WHERE tenant_id=$1 AND status='ACTIVE' AND configuration_key<>$2
            AND establishment_id=$3 AND operation_type=$4
            AND commodity IS NOT DISTINCT FROM $5 AND destination_uf IS NOT DISTINCT FROM $6
            AND (effective_to IS NULL OR effective_to >= $7::date)
            AND ($8::date IS NULL OR effective_from <= $8::date)
          LIMIT 1`,
        [tenantId, configuration.configuration_key, configuration.establishment_id,
          configuration.operation_type, configuration.commodity, configuration.destination_uf,
          configuration.effective_from, configuration.effective_to]);
      if (overlap.rowCount) throw new ConflictException({ code: 'FISCAL_CONFIGURATION_OVERLAP' });
      await client.query(
        `UPDATE app.fiscal_configuration_versions SET status='RETIRED',updated_by=$3,updated_at=now()
          WHERE tenant_id=$1 AND configuration_key=$2 AND status='ACTIVE'`,
        [tenantId, configuration.configuration_key, actorId]);
      await client.query(
        `UPDATE app.fiscal_configuration_versions
            SET status='ACTIVE',activated_by=$3,activated_at=now(),updated_by=$3,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`, [tenantId, configurationId, actorId]);
      await this.record(client, tenantId, actorId, 'fiscal.configuration_activated', 'fiscal_configuration',
        configurationId, { configurationKey: configuration.configuration_key, version: configuration.version });
      return { id: configurationId, status: 'ACTIVE' };
    });
  }

  newConfigurationVersion(tenantId: string, actorId: string, configurationId: string) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const source = await this.lockConfiguration(client, tenantId, configurationId);
      if (source.status === 'DRAFT') {
        throw new ConflictException({ code: 'FISCAL_CONFIGURATION_VERSION_REQUIRES_ACTIVE' });
      }
      const draft = await client.query(
        `SELECT 1 FROM app.fiscal_configuration_versions
          WHERE tenant_id=$1 AND configuration_key=$2 AND status='DRAFT' AND id<>$3 LIMIT 1`,
        [tenantId, source.configuration_key, configurationId]);
      if (draft.rowCount) throw new ConflictException({ code: 'FISCAL_CONFIGURATION_DRAFT_EXISTS' });
      const next = await client.query<{ version: number }>(
        `SELECT max(version)+1 AS version FROM app.fiscal_configuration_versions
          WHERE tenant_id=$1 AND configuration_key=$2`, [tenantId, source.configuration_key]);
      const id = randomUUID();
      await client.query(
        `INSERT INTO app.fiscal_configuration_versions
          (tenant_id,id,configuration_key,version,establishment_id,name,operation_type,commodity,
           destination_uf,cfop,emission_strategy,technical_responsible,effective_from,effective_to,
           tax_components,rounding_mode,rounding_scale,status,created_by,updated_by)
         SELECT tenant_id,$3,configuration_key,$4,establishment_id,name,operation_type,commodity,
                destination_uf,cfop,emission_strategy,technical_responsible,effective_from,effective_to,
                tax_components,rounding_mode,rounding_scale,'DRAFT',$5,$5
           FROM app.fiscal_configuration_versions WHERE tenant_id=$1 AND id=$2`,
        [tenantId, configurationId, id, next.rows[0]!.version, actorId]);
      await this.record(client, tenantId, actorId, 'fiscal.configuration_version_created',
        'fiscal_configuration', id,
        { configurationKey: source.configuration_key, version: next.rows[0]!.version, sourceId: configurationId });
      return { id, configurationKey: source.configuration_key, version: next.rows[0]!.version, status: 'DRAFT' };
    });
  }

  calculate(tenantId: string, actorId: string, input: CreateFiscalCalculationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      const inputSnapshot = {
        establishmentId: input.establishmentId, operationType: input.operationType,
        commodity: input.commodity, destinationUf: input.destinationUf, occurredOn: input.occurredOn,
        grossAmount: input.grossAmount, currency: input.currency,
        sourceType: input.sourceType, sourceId: input.sourceId,
      };
      const existing = await this.calculationByRequestKey(client, tenantId, input.requestKey);
      if (existing) {
        const comparison = await client.query<{ matches: boolean }>(
          `SELECT input_snapshot=$3::jsonb AS matches FROM app.fiscal_calculations
            WHERE tenant_id=$1 AND request_key=$2`,
          [tenantId, input.requestKey, JSON.stringify(inputSnapshot)]);
        if (!comparison.rows[0]?.matches) {
          throw new ConflictException({ code: 'FISCAL_CALCULATION_IDEMPOTENCY_CONFLICT' });
        }
        return this.mapCalculation(existing);
      }

      if (input.sourceType === 'FINANCIAL_EVENT') {
        const source = await client.query<{
          event_type: string; calculation_status: string; calculated_amount: string | null;
        }>(
          `SELECT event_type,calculation_status,calculated_amount::text
             FROM app.financial_events
            WHERE tenant_id=$1 AND id=$2`, [tenantId, input.sourceId]);
        if (!source.rows[0]) throw new NotFoundException({ code: 'FINANCIAL_EVENT_NOT_FOUND' });
        if (source.rows[0].event_type !== 'SALE_DISPATCH_RECEIVABLE'
          || source.rows[0].calculation_status !== 'READY' || !source.rows[0].calculated_amount) {
          throw new ConflictException({ code: 'FISCAL_CALCULATION_SOURCE_NOT_READY' });
        }
        if (!new Decimal(source.rows[0].calculated_amount).equals(input.grossAmount)) {
          throw new UnprocessableEntityException({
            code: 'FISCAL_CALCULATION_SOURCE_AMOUNT_MISMATCH',
            sourceAmount: source.rows[0].calculated_amount,
          });
        }
      }

      const selected = await client.query<FiscalConfigurationRow>(
        `SELECT fc.id,fc.configuration_key,fc.version,fc.establishment_id,
                fe.legal_name AS establishment_name,fe.uf AS establishment_uf,fe.tax_regime,
                fe.active AS establishment_active,
                fc.name,fc.operation_type,fc.commodity,fc.destination_uf,fc.cfop,
                fc.emission_strategy,fc.technical_responsible,fc.effective_from::text,
                fc.effective_to::text,fc.rounding_mode,fc.rounding_scale,
                fc.tax_components,fc.status,fc.updated_at,fc.activated_at
           FROM app.fiscal_configuration_versions fc
           JOIN app.fiscal_establishments fe
             ON (fe.tenant_id,fe.id)=(fc.tenant_id,fc.establishment_id)
          WHERE fc.tenant_id=$1 AND fc.status='ACTIVE' AND fe.active=true
            AND fc.establishment_id=$2 AND fc.operation_type=$3
            AND upper(fc.commodity)=upper($4) AND fc.destination_uf=$5
            AND fc.effective_from <= $6::date
            AND (fc.effective_to IS NULL OR fc.effective_to >= $6::date)
          ORDER BY fc.version DESC LIMIT 2`,
        [tenantId, input.establishmentId, input.operationType, input.commodity,
          input.destinationUf, input.occurredOn]);
      if (!selected.rows.length) {
        throw new UnprocessableEntityException({ code: 'FISCAL_CONFIGURATION_NOT_APPLICABLE' });
      }
      if (selected.rows.length > 1) {
        throw new ConflictException({ code: 'FISCAL_CONFIGURATION_AMBIGUOUS' });
      }
      const configuration = selected.rows[0]!;
      if (configuration.rounding_mode === null || configuration.rounding_scale === null) {
        throw new ConflictException({ code: 'FISCAL_CONFIGURATION_INVALID' });
      }
      const parsed = taxComponentSchema.array().safeParse(configuration.tax_components);
      if (!parsed.success || parsed.data.some((component) => component.basis === null)) {
        throw new ConflictException({ code: 'FISCAL_CONFIGURATION_INVALID' });
      }
      let memory;
      try {
        memory = calculateFiscalMemory({
          grossAmount: input.grossAmount, roundingMode: configuration.rounding_mode,
          roundingScale: configuration.rounding_scale,
          components: parsed.data as FiscalCalculationComponent[],
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'FISCAL_RETENTION_EXCEEDS_GROSS') {
          throw new UnprocessableEntityException({ code: error.message });
        }
        throw error;
      }
      const id = randomUUID();
      const inserted = await client.query(
        `INSERT INTO app.fiscal_calculations
          (tenant_id,id,request_key,configuration_id,configuration_key,configuration_version,
           establishment_id,operation_type,commodity,destination_uf,occurred_on,source_type,
           source_id,currency,gross_amount,tax_total,retained_total,net_amount,input_snapshot,
           result_snapshot,calculated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21)
         ON CONFLICT (tenant_id,request_key) DO NOTHING RETURNING id`,
        [tenantId, id, input.requestKey, configuration.id, configuration.configuration_key,
          configuration.version, input.establishmentId, input.operationType, input.commodity,
          input.destinationUf, input.occurredOn, input.sourceType, input.sourceId, input.currency,
          input.grossAmount, memory.taxTotal, memory.retainedTotal, memory.netAmount,
          JSON.stringify(inputSnapshot), JSON.stringify(memory), actorId]);
      if (!inserted.rowCount) {
        throw new ConflictException({ code: 'FISCAL_CALCULATION_IDEMPOTENCY_CONFLICT' });
      }
      await this.record(client, tenantId, actorId, 'fiscal.calculation_completed', 'fiscal_calculation', id,
        { configurationId: configuration.id, configurationKey: configuration.configuration_key,
          configurationVersion: configuration.version, requestKey: input.requestKey,
          grossAmount: input.grossAmount, taxTotal: memory.taxTotal,
          retainedTotal: memory.retainedTotal, netAmount: memory.netAmount });
      return {
        id, requestKey: input.requestKey,
        configuration: {
          id: configuration.id, key: configuration.configuration_key, version: configuration.version,
          name: configuration.name,
        },
        establishment: { id: input.establishmentId, name: configuration.establishment_name! },
        context: inputSnapshot, result: memory, status: 'CALCULATED', acceptance: null,
      };
    });
  }

  acceptCalculation(tenantId: string, actorId: string, calculationId: string,
    input: AcceptFiscalCalculationInput) {
    return this.db.transaction(tenantId, async (client) => {
      await this.assertCapability(client, tenantId, actorId, 'FISCAL_EDIT');
      await this.assertCapability(client, tenantId, actorId, 'FINANCE_EDIT');
      const normalized = {
        obligations: [...input.obligations].sort((left, right) => left.tax.localeCompare(right.tax)),
      };
      const calculation = await client.query<{
        status: string; acceptance_request_key: string | null; acceptance_snapshot: unknown | null;
        input_snapshot: unknown; result_snapshot: unknown;
      }>(
        `SELECT status,acceptance_request_key,acceptance_snapshot,input_snapshot,result_snapshot
           FROM app.fiscal_calculations
          WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, calculationId]);
      if (!calculation.rows[0]) {
        throw new NotFoundException({ code: 'FISCAL_CALCULATION_NOT_FOUND' });
      }
      if (calculation.rows[0].status === 'ACCEPTED') {
        const comparison = await client.query<{ matches: boolean }>(
          `SELECT acceptance_request_key=$3 AND acceptance_snapshot=$4::jsonb AS matches
             FROM app.fiscal_calculations WHERE tenant_id=$1 AND id=$2`,
          [tenantId, calculationId, input.requestKey, JSON.stringify(normalized)],
        );
        if (!comparison.rows[0]?.matches) {
          throw new ConflictException({ code: 'FISCAL_CALCULATION_ALREADY_ACCEPTED' });
        }
        return { id: calculationId, status: 'ACCEPTED', idempotent: true };
      }

      const context = calculation.rows[0].input_snapshot as {
        sourceType?: string; sourceId?: string | null;
      };
      const memory = calculation.rows[0].result_snapshot as {
        components?: Array<{ tax: string; amount: string; retained: boolean }>;
      };
      if (!Array.isArray(memory.components)) {
        throw new ConflictException({ code: 'FISCAL_CALCULATION_MEMORY_INVALID' });
      }
      const components = memory.components.filter((component) => new Decimal(component.amount).greaterThan(0));
      const expectedTaxes = components.map((component) => component.tax).sort();
      const informedTaxes = normalized.obligations.map((obligation) => obligation.tax).sort();
      if (JSON.stringify(expectedTaxes) !== JSON.stringify(informedTaxes)) {
        throw new UnprocessableEntityException({ code: 'FISCAL_OBLIGATION_COMPONENTS_MISMATCH' });
      }

      const authorityIds = [...new Set(normalized.obligations.map((obligation) => obligation.authorityId))];
      const authorities = await client.query<{ id: string; legal_name: string }>(
        `SELECT id,legal_name FROM app.fiscal_authorities
          WHERE tenant_id=$1 AND active=true AND id=ANY($2::uuid[])`, [tenantId, authorityIds]);
      if (authorities.rowCount !== authorityIds.length) {
        throw new NotFoundException({ code: 'FISCAL_AUTHORITY_NOT_FOUND' });
      }
      const authorityNames = new Map(authorities.rows.map((authority) => [authority.id, authority.legal_name]));
      const effects = [];
      for (const obligationInput of normalized.obligations) {
        const component = components.find((candidate) => candidate.tax === obligationInput.tax)!;
        if (obligationInput.titleEffect === 'REDUCE_SOURCE_TITLE' && !component.retained) {
          throw new UnprocessableEntityException({ code: 'FISCAL_TITLE_REDUCTION_REQUIRES_RETENTION' });
        }
        if (obligationInput.titleEffect === 'REDUCE_SOURCE_TITLE'
          && (context.sourceType !== 'FINANCIAL_EVENT' || !context.sourceId)) {
          throw new ConflictException({ code: 'FISCAL_SOURCE_TITLE_REQUIRED' });
        }
        const obligationId = randomUUID();
        await client.query(
          `INSERT INTO app.fiscal_obligations
            (tenant_id,id,calculation_id,component_tax,authority_id,competence_date,due_date,
             amount,currency,retained,title_effect,payment_responsibility,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BRL',$9,$10,$11,$12)`,
          [tenantId, obligationId, calculationId, obligationInput.tax, obligationInput.authorityId,
            obligationInput.competenceDate, obligationInput.dueDate, component.amount,
            component.retained, obligationInput.titleEffect,
            obligationInput.paymentResponsibility, actorId],
        );
        const effect = await this.finance.applyFiscalObligation(client, {
          tenantId, actorId, obligationId,
          sourceFinancialEventId: context.sourceType === 'FINANCIAL_EVENT' ? context.sourceId ?? null : null,
          authorityId: obligationInput.authorityId,
          authorityName: authorityNames.get(obligationInput.authorityId)!,
          tax: obligationInput.tax, amount: component.amount,
          competenceDate: obligationInput.competenceDate, dueDate: obligationInput.dueDate,
          titleEffect: obligationInput.titleEffect,
          paymentResponsibility: obligationInput.paymentResponsibility,
          titleNumber: obligationInput.titleNumber,
          documentReference: obligationInput.documentReference,
        });
        effects.push({ obligationId, tax: obligationInput.tax, ...effect });
        await this.record(client, tenantId, actorId, 'fiscal.obligation_confirmed',
          'fiscal_obligation', obligationId, {
            calculationId, tax: obligationInput.tax, authorityId: obligationInput.authorityId,
            competenceDate: obligationInput.competenceDate, dueDate: obligationInput.dueDate,
            amount: component.amount, retained: component.retained,
            titleEffect: obligationInput.titleEffect,
            paymentResponsibility: obligationInput.paymentResponsibility,
          });
      }
      const updated = await client.query(
        `UPDATE app.fiscal_calculations
            SET status='ACCEPTED',acceptance_request_key=$3,acceptance_snapshot=$4::jsonb,
                accepted_by=$5,accepted_at=now()
          WHERE tenant_id=$1 AND id=$2 AND status='CALCULATED'`,
        [tenantId, calculationId, input.requestKey, JSON.stringify(normalized), actorId],
      );
      if (updated.rowCount !== 1) {
        throw new ConflictException({ code: 'FISCAL_CALCULATION_ALREADY_ACCEPTED' });
      }
      await this.record(client, tenantId, actorId, 'fiscal.calculation_accepted',
        'fiscal_calculation', calculationId, {
          requestKey: input.requestKey, obligationCount: effects.length,
          obligations: effects,
        });
      return { id: calculationId, status: 'ACCEPTED', idempotent: false, obligations: effects };
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

  private mapConfiguration(row: FiscalConfigurationRow) {
    return {
      id: row.id, configurationKey: row.configuration_key, version: row.version,
      establishmentId: row.establishment_id, establishmentName: row.establishment_name,
      establishmentUf: row.establishment_uf, taxRegime: row.tax_regime,
      name: row.name, operationType: row.operation_type, commodity: row.commodity,
      destinationUf: row.destination_uf, cfop: row.cfop, emissionStrategy: row.emission_strategy,
      technicalResponsible: row.technical_responsible, effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to, roundingMode: row.rounding_mode,
      roundingScale: row.rounding_scale, taxComponents: row.tax_components, status: row.status,
      updatedAt: row.updated_at.toISOString(), activatedAt: row.activated_at?.toISOString() ?? null,
    };
  }

  private mapCalculation(row: FiscalCalculationRow) {
    return {
      id: row.id, requestKey: row.request_key,
      configuration: {
        id: row.configuration_id, key: row.configuration_key,
        version: row.configuration_version, name: row.configuration_name,
      },
      establishment: { id: row.establishment_id, name: row.establishment_name },
      context: row.input_snapshot,
      result: row.result_snapshot,
      status: row.status,
      acceptance: row.status === 'ACCEPTED' ? {
        requestKey: row.acceptance_request_key!, snapshot: row.acceptance_snapshot,
        acceptedBy: row.accepted_by!, acceptedAt: row.accepted_at!.toISOString(),
      } : null,
      operationType: row.operation_type, commodity: row.commodity,
      destinationUf: row.destination_uf, occurredOn: row.occurred_on,
      sourceType: row.source_type, sourceId: row.source_id, currency: row.currency,
      grossAmount: row.gross_amount, taxTotal: row.tax_total,
      retainedTotal: row.retained_total, netAmount: row.net_amount,
      calculatedBy: row.calculated_by, calculatedAt: row.calculated_at.toISOString(),
    };
  }

  private configurationBlockers(establishments: FiscalEstablishmentRow[], activeConfigurationCount: number) {
    if (activeConfigurationCount) return [];
    const blockers: string[] = [];
    if (!establishments.length) blockers.push('Cadastre ao menos um estabelecimento fiscal do tenant.');
    if (establishments.some((establishment) => establishment.tax_regime === null)) {
      blockers.push('Informe o regime tributário dos estabelecimentos usados no piloto.');
    }
    blockers.push('Complete e ative uma versão com CFOP, vigência, emissão, responsável e incidências.');
    return blockers;
  }

  private async assertEstablishment(client: PoolClient, tenantId: string, establishmentId: string | null) {
    if (establishmentId === null) return;
    const result = await client.query(
      'SELECT 1 FROM app.fiscal_establishments WHERE tenant_id=$1 AND id=$2 AND active=true',
      [tenantId, establishmentId]);
    if (!result.rowCount) throw new NotFoundException({ code: 'FISCAL_ESTABLISHMENT_NOT_FOUND' });
  }

  private async lockConfiguration(client: PoolClient, tenantId: string, configurationId: string) {
    const result = await client.query<FiscalConfigurationRow>(
      `SELECT fc.id,fc.configuration_key,fc.version,fc.establishment_id,
              fe.legal_name AS establishment_name,fe.uf AS establishment_uf,fe.tax_regime,
              fe.active AS establishment_active,
              fc.name,fc.operation_type,fc.commodity,fc.destination_uf,fc.cfop,
              fc.emission_strategy,fc.technical_responsible,fc.effective_from::text,
              fc.effective_to::text,fc.rounding_mode,fc.rounding_scale,
              fc.tax_components,fc.status,fc.updated_at,fc.activated_at
         FROM app.fiscal_configuration_versions fc
         LEFT JOIN app.fiscal_establishments fe
           ON (fe.tenant_id,fe.id)=(fc.tenant_id,fc.establishment_id)
        WHERE fc.tenant_id=$1 AND fc.id=$2 FOR UPDATE OF fc`, [tenantId, configurationId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'FISCAL_CONFIGURATION_NOT_FOUND' });
    return result.rows[0];
  }

  private missingActivationFields(configuration: FiscalConfigurationRow): string[] {
    const fields: string[] = [];
    if (!configuration.establishment_id) fields.push('establishmentId');
    if (configuration.establishment_active === false) fields.push('establishmentActive');
    if (!configuration.tax_regime) fields.push('taxRegime');
    if (!configuration.commodity) fields.push('commodity');
    if (!configuration.destination_uf) fields.push('destinationUf');
    if (!configuration.cfop) fields.push('cfop');
    if (!configuration.emission_strategy) fields.push('emissionStrategy');
    if (!configuration.technical_responsible) fields.push('technicalResponsible');
    if (!configuration.effective_from) fields.push('effectiveFrom');
    if (!Array.isArray(configuration.tax_components) || !configuration.tax_components.length) fields.push('taxComponents');
    if (Array.isArray(configuration.tax_components)
      && configuration.tax_components.some((component) => typeof component !== 'object'
        || component === null || !('basis' in component) || component.basis !== 'DOCUMENT_TOTAL')) {
      fields.push('taxComponents.basis');
    }
    if (!configuration.rounding_mode) fields.push('roundingMode');
    if (configuration.rounding_scale === null) fields.push('roundingScale');
    return fields;
  }

  private async calculationByRequestKey(client: PoolClient, tenantId: string, requestKey: string) {
    const result = await client.query<FiscalCalculationRow>(
      `SELECT c.id,c.request_key,c.configuration_id,c.configuration_key,c.configuration_version,
              fc.name AS configuration_name,c.establishment_id,fe.legal_name AS establishment_name,
              c.operation_type,c.commodity,c.destination_uf,c.occurred_on::text,c.source_type,
              c.source_id,c.currency,c.gross_amount::text,c.tax_total::text,c.retained_total::text,
              c.net_amount::text,c.input_snapshot,c.result_snapshot,c.calculated_by,c.calculated_at,
              c.status,c.acceptance_request_key,c.acceptance_snapshot,c.accepted_by,c.accepted_at
         FROM app.fiscal_calculations c
         JOIN app.fiscal_configuration_versions fc
           ON (fc.tenant_id,fc.id)=(c.tenant_id,c.configuration_id)
         JOIN app.fiscal_establishments fe
           ON (fe.tenant_id,fe.id)=(c.tenant_id,c.establishment_id)
        WHERE c.tenant_id=$1 AND c.request_key=$2`, [tenantId, requestKey]);
    return result.rows[0] ?? null;
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
