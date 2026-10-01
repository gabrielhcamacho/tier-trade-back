import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('commercial foundation migration', () => {
  it('applies and isolates rows through the transaction tenant context', async () => {
    const db = new PGlite();
    const migration = await readFile(
      new URL('../../migrations/0001_commercial_foundation.sql', import.meta.url),
      'utf8',
    );
    await db.exec(migration);
    await db.exec(`
      INSERT INTO app.tenants (id,legal_name,timezone) VALUES
        ('11111111-1111-4111-8111-111111111111','A','America/Sao_Paulo'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','B','America/Sao_Paulo');
      INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id) VALUES
        ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','A supplier','1'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B supplier','2');
      CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA app TO app_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO app_runtime;
      SET ROLE app_runtime;
      SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',false);
    `);
    const result = await db.query<{ legal_name: string }>('SELECT legal_name FROM app.counterparties ORDER BY legal_name');
    expect(result.rows).toEqual([{ legal_name: 'A supplier' }]);
    await db.close();
  });
});
