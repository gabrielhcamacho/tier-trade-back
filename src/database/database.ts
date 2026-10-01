import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

export abstract class DatabasePlatformPort {
  abstract transaction<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T>;
  abstract one<T extends QueryResultRow>(client: PoolClient, text: string, values: unknown[]): Promise<T>;
  abstract ping(): Promise<void>;
}

@Injectable()
export class TenantDatabase extends DatabasePlatformPort implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async transaction<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async one<T extends QueryResultRow>(client: PoolClient, text: string, values: unknown[]): Promise<T> {
    const result = await client.query<T>(text, values);
    if (result.rows.length !== 1) throw new Error('Expected exactly one database row.');
    return result.rows[0]!;
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
      },
    },
    TenantDatabase,
    { provide: DatabasePlatformPort, useExisting: TenantDatabase },
  ],
  exports: [DatabasePlatformPort],
})
export class DatabaseModule {}
