import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_SEED_VERSION, resetDemoTenant } from './demo-seed.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const demoTenantId = '11111111-1111-4111-8111-111111111111';
const demoActorId = '22222222-2222-4222-8222-222222222222';
const protectedTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const protectedActorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe.runIf(Boolean(databaseUrl))('canonical demo tenant seed', () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/tier_trade_test') {
      throw new Error('TEST_DATABASE_URL must target the dedicated tier_trade_test database.');
    }
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('DROP SCHEMA IF EXISTS control CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS app CASCADE');
    for (const migrationName of [
      '20261001000100_commercial_foundation.sql',
      '20261001000200_outbox_read_models.sql',
      '20261001000300_commercial_governance.sql',
      '20261001193311_harden_tenant_rls.sql',
      '20261001194949_optimize_tenant_rls.sql',
      '20261001224302_control_plane_access.sql',
      '20261001224527_index_control_invitation_inviter.sql',
      '20261002030013_operations_load_scheduling.sql',
      '20261002031951_grant_operations_runtime.sql',
      '20261002042905_demo_tenant_contract_portfolio.sql',
      '20261002162513_operations_receiving_quality.sql',
      '20261002163915_grant_demo_reset_load_receipts.sql',
      '20261002174124_inventory_receipt_ledger.sql',
      '20261002211618_sales_fulfillment_slice.sql',
    ]) {
      await pool.query(await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8'));
    }
    await pool.query(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await pool.query('UPDATE app.tenants SET is_demo=true,demo_seed_version=$2 WHERE id=$1',
      [demoTenantId, DEMO_SEED_VERSION]);
    await pool.query(
      "INSERT INTO app.tenants (id,legal_name,timezone) VALUES ($1,'Tenant protegido','America/Sao_Paulo')",
      [protectedTenantId],
    );
    await pool.query(
      `INSERT INTO app.memberships (tenant_id,user_id,capabilities)
       VALUES ($1,$2,ARRAY['COMMERCIAL_EDIT','OPERATIONS_EDIT'])`,
      [protectedTenantId, protectedActorId],
    );
    await pool.query(
      `INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id)
       VALUES ($1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Registro protegido','12345678901')`,
      [protectedTenantId],
    );
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('restores an editable, realistic dataset and leaves other tenants unchanged', async () => {
    const first = await resetDemoTenant(pool, { tenantId: demoTenantId, actorId: demoActorId });
    expect(first).toEqual({
      tenantId: demoTenantId,
      seedVersion: 4,
      counterparties: 5,
      offers: 4,
      contracts: 2,
      loads: 3,
      receipts: 2,
      inventoryLots: 1,
      inventoryMovements: 2,
      salesContracts: 1,
      allocations: 1,
      dispatches: 1,
    });

    const data = await pool.query<{
      legal_name: string;
      demo_seed_version: number;
      counterparties: number;
      offers: number;
      contracts: number;
      loads: number;
      receipts: number;
      inventory_lots: number;
      inventory_movements: number;
      sales_contracts: number;
      allocations: number;
      dispatches: number;
      contracted_sc: string;
      scheduled_kg: string;
    }>(
      `SELECT t.legal_name,t.demo_seed_version,
              (SELECT count(*)::integer FROM app.counterparties WHERE tenant_id=t.id) AS counterparties,
              (SELECT count(*)::integer FROM app.offers WHERE tenant_id=t.id) AS offers,
              (SELECT count(*)::integer FROM app.contracts WHERE tenant_id=t.id) AS contracts,
              (SELECT count(*)::integer FROM app.loads WHERE tenant_id=t.id) AS loads,
              (SELECT count(*)::integer FROM app.load_receipts WHERE tenant_id=t.id) AS receipts,
              (SELECT count(*)::integer FROM app.inventory_lots WHERE tenant_id=t.id) AS inventory_lots,
              (SELECT count(*)::integer FROM app.inventory_movements WHERE tenant_id=t.id) AS inventory_movements,
              (SELECT count(*)::integer FROM app.sales_contracts WHERE tenant_id=t.id) AS sales_contracts,
              (SELECT count(*)::integer FROM app.inventory_allocations WHERE tenant_id=t.id) AS allocations,
              (SELECT count(*)::integer FROM app.inventory_dispatches WHERE tenant_id=t.id) AS dispatches,
              (SELECT sum(quantity_sc)::text FROM app.offers WHERE tenant_id=t.id AND status='CONVERTED') AS contracted_sc,
              (SELECT sum(expected_weight_kg)::text FROM app.loads WHERE tenant_id=t.id) AS scheduled_kg
         FROM app.tenants t WHERE t.id=$1`,
      [demoTenantId],
    );
    expect(data.rows[0]).toEqual({
      legal_name: 'Cerrado Trading — Demonstração',
      demo_seed_version: 4,
      counterparties: 5,
      offers: 4,
      contracts: 2,
      loads: 3,
      receipts: 2,
      inventory_lots: 1,
      inventory_movements: 2,
      sales_contracts: 1,
      allocations: 1,
      dispatches: 1,
      contracted_sc: '32500.000000',
      scheduled_kg: '144000.000',
    });

    await pool.query(
      "UPDATE app.offers SET quantity_sc=1 WHERE tenant_id=$1 AND id='d2000000-0000-4000-8000-000000000001'",
      [demoTenantId],
    );
    await resetDemoTenant(pool, { tenantId: demoTenantId, actorId: demoActorId });
    const restored = await pool.query<{ quantity_sc: string }>(
      "SELECT quantity_sc FROM app.offers WHERE tenant_id=$1 AND id='d2000000-0000-4000-8000-000000000001'",
      [demoTenantId],
    );
    expect(restored.rows[0]?.quantity_sc).toBe('20000.000000');

    await expect(resetDemoTenant(pool, { tenantId: protectedTenantId, actorId: protectedActorId }))
      .rejects.toThrow('TENANT_IS_NOT_MARKED_AS_DEMO');
    const protectedRows = await pool.query<{ legal_name: string }>(
      'SELECT legal_name FROM app.counterparties WHERE tenant_id=$1',
      [protectedTenantId],
    );
    expect(protectedRows.rows).toEqual([{ legal_name: 'Registro protegido' }]);
  });
});
