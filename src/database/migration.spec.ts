import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('commercial foundation migration', () => {
  it('applies and isolates rows through the transaction tenant context', async () => {
    const db = new PGlite();
    for (const migrationName of [
      '0001_commercial_foundation.sql',
      '0002_outbox_read_models.sql',
      '0003_commercial_governance.sql',
    ]) {
      const migration = await readFile(new URL(`../../migrations/${migrationName}`, import.meta.url), 'utf8');
      await db.exec(migration);
    }
    await db.exec(`
      INSERT INTO app.tenants (id,legal_name,timezone) VALUES
        ('11111111-1111-4111-8111-111111111111','A','America/Sao_Paulo'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','B','America/Sao_Paulo');
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
      SET ROLE app_runtime;
      SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false);
    `);
    const result = await db.query<{ legal_name: string }>('SELECT legal_name FROM app.counterparties ORDER BY legal_name');
    expect(result.rows).toEqual([{ legal_name: 'A supplier' }]);
    const activity = await db.query<{ event_id: string }>('SELECT event_id FROM app.commercial_activity_read_model');
    expect(activity.rows).toEqual([{ event_id: '44444444-4444-4444-8444-444444444444' }]);
    const readModels = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='app' AND table_name LIKE '%read_model' ORDER BY table_name`,
    );
    expect(readModels.rows).toEqual([
      { table_name: 'commercial_activity_read_model' },
      { table_name: 'contract_summary_read_model' },
    ]);
    await db.close();
  });
});
