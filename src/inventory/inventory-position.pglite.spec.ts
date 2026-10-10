import { PGlite } from '@electric-sql/pglite';
import Decimal from 'decimal.js';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { DatabasePlatformPort } from '../database/database.js';
import { resetDemoTenant } from '../demo/demo-seed.js';
import { FinanceService } from '../finance/finance.service.js';
import { InventoryService } from './inventory.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';

describe('inventory economic reconciliation with PGlite', () => {
  it('connects dispatch, load, fiscal document, title and settlement without mutating them', async () => {
    const embedded = new PGlite();
    await embedded.exec('CREATE ROLE tier_trade_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    const migrationsDirectory = new URL('../../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .toSorted();
    for (const migration of migrations) {
      await embedded.exec(await readFile(new URL(migration, migrationsDirectory), 'utf8'));
    }
    await embedded.exec(await readFile(new URL('../../scripts/seed-local.sql', import.meta.url), 'utf8'));
    await embedded.query('UPDATE app.tenants SET is_demo=true WHERE id=$1', [tenantId]);

    const client = {
      query: async (text: string, values?: unknown[]) => {
        const result = await embedded.query(text, values);
        return { ...result, rowCount: result.rows.length > 0 ? result.rows.length : result.affectedRows };
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = { connect: async () => client } as unknown as Pool;
    await resetDemoTenant(pool, { tenantId, actorId });

    const database = {
      transaction: async <T>(contextTenantId: string, operation: (transaction: PoolClient) => Promise<T>) => {
        await embedded.query('BEGIN');
        try {
          await embedded.query("SELECT set_config('app.tenant_id',$1,true)", [contextTenantId]);
          const result = await operation(client);
          await embedded.query('COMMIT');
          return result;
        } catch (error) {
          await embedded.query('ROLLBACK');
          throw error;
        }
      },
    } as DatabasePlatformPort;
    const receipt = await embedded.query<{ id: string }>(
      `SELECT receipt.id
         FROM app.inventory_lots lot
         JOIN app.load_receipts receipt
           ON (receipt.tenant_id,receipt.load_id)=(lot.tenant_id,lot.source_load_id)
          AND receipt.is_current=true
        WHERE lot.tenant_id=$1 AND lot.id='da000000-0000-4000-8000-000000000001'`, [tenantId]);
    const finance = new FinanceService(database);
    await database.transaction(tenantId, (transaction) => finance.projectPurchaseReceipt(transaction, {
      tenantId, actorId, receiptId: receipt.rows[0]!.id,
    }));
    const inventory = new InventoryService(database, finance);
    const position = await inventory.position(tenantId, actorId);

    expect(position.economicReconciliations).toMatchObject([{
      dispatch_id: 'de000000-0000-4000-8000-000000000001',
      source_load_id: 'd7000000-0000-4000-8000-000000000001',
      sales_contract_reference: 'CV-2026-0042',
      revenue_amount: '11360.00',
      fiscal_document_number: 'NFE-DEMO-0001',
      fiscal_document_status: 'RECEIVED',
      title_number: 'TR-2026-0001',
      title_status: 'PARTIALLY_SETTLED',
      settled_amount: '4000.00',
      outstanding_amount: '7360.00',
    }]);
    const reconciliation = position.economicReconciliations[0]!;
    expect(reconciliation).toMatchObject({
      purchase_financial_event_id: expect.any(String),
      allocated_acquisition_cost_amount: expect.any(String),
      allocated_component_impact_amount: '0.00',
      operational_margin_amount: expect.any(String),
    });
    expect(new Decimal(reconciliation.revenue_amount)
      .minus(reconciliation.allocated_acquisition_cost_amount)
      .minus(reconciliation.allocated_component_impact_amount)
      .toFixed(2)).toBe(new Decimal(reconciliation.operational_margin_amount).toFixed(2));
    await embedded.close();
  }, 30_000);
});
