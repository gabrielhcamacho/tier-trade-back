import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('commercial foundation migration', () => {
  it('applies and isolates rows through the transaction tenant context', async () => {
    const db = new PGlite();
    await db.exec('CREATE ROLE tier_trade_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
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
    ]) {
      const migration = await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
      await db.exec(migration);
    }
    await db.exec(`
      INSERT INTO app.tenants (id,legal_name,timezone) VALUES
        ('11111111-1111-4111-8111-111111111111','A','America/Sao_Paulo'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','B','America/Sao_Paulo');
      INSERT INTO app.memberships (tenant_id,user_id,capabilities) VALUES
        ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',ARRAY['COMMERCIAL_EDIT']);
      INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id) VALUES
        ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','A supplier','1'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B supplier','2');
      INSERT INTO app.commercial_activity_read_model
        (tenant_id,event_id,event_type,aggregate_type,aggregate_id,payload,occurred_at) VALUES
        ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','offer.created','offer','33333333-3333-4333-8333-333333333333','{}',now()),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','offer.created','offer','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',now());
      CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA app TO app_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO app_runtime;
      GRANT USAGE ON SCHEMA control TO app_runtime;
      GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA control TO app_runtime;
      SET ROLE app_runtime;
      SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false);
    `);
    const result = await db.query<{ legal_name: string }>('SELECT legal_name FROM app.counterparties ORDER BY legal_name');
    expect(result.rows).toEqual([{ legal_name: 'A supplier' }]);
    const activity = await db.query<{ event_id: string }>('SELECT event_id FROM app.commercial_activity_read_model');
    expect(activity.rows).toEqual([{ event_id: '44444444-4444-4444-8444-444444444444' }]);
    await db.exec('RESET ROLE');
    const directory = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM control.membership_directory
        WHERE user_id='22222222-2222-4222-8222-222222222222' AND active=true`,
    );
    expect(directory.rows).toEqual([{ tenant_id: '11111111-1111-4111-8111-111111111111' }]);
    const readModels = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='app' AND table_name LIKE '%read_model' ORDER BY table_name`,
    );
    expect(readModels.rows).toEqual([
      { table_name: 'commercial_activity_read_model' },
      { table_name: 'contract_summary_read_model' },
    ]);
    await db.exec("SET ROLE tier_trade_runtime; SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false)");
    const visibleLoads = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.loads');
    expect(visibleLoads.rows).toEqual([{ count: 0 }]);
    const visibleReceipts = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.load_receipts');
    expect(visibleReceipts.rows).toEqual([{ count: 0 }]);
    const visibleLots = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.inventory_lots');
    expect(visibleLots.rows).toEqual([{ count: 0 }]);
    const visibleMovements = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM app.inventory_movements');
    expect(visibleMovements.rows).toEqual([{ count: 0 }]);
    await db.exec('RESET ROLE');
    await db.close();
  });
});
