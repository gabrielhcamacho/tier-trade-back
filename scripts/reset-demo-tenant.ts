import { Pool } from 'pg';
import { z } from 'zod';
import { resetDemoTenant } from '../src/demo/demo-seed.js';

const inputSchema = z.object({
  tenantId: z.uuid(),
  actorId: z.uuid(),
  confirmation: z.literal('RESET_DEMO_TENANT'),
  databaseUrl: z.string().min(1),
});

async function main(): Promise<void> {
  const input = inputSchema.parse({
    tenantId: argument('--tenant-id'),
    actorId: argument('--actor-id'),
    confirmation: argument('--confirm'),
    databaseUrl: process.env.DATABASE_URL,
  });

  const pool = new Pool({ connectionString: input.databaseUrl, max: 1 });
  try {
    const result = await resetDemoTenant(pool, input);
    process.stdout.write(`${JSON.stringify({ event: 'demo.tenant.reset', ...result })}\n`);
  } finally {
    await pool.end();
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

void main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message : 'UNKNOWN_DEMO_RESET_ERROR';
  process.stderr.write(`${JSON.stringify({ event: 'demo.tenant.reset_failed', code })}\n`);
  process.exitCode = 1;
});
