import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AUTH_MODE: z.enum(['development', 'supabase']).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  WEB_ORIGIN: z.string().optional(),
  WEB_URL: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('tier-trade-api'),
});

const workerSchema = baseSchema.extend({
  TENANT_ID: z.uuid(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  OUTBOX_OBSERVABILITY_PORT: z.coerce.number().int().min(1).max(65_535).default(9464),
  OUTBOX_HEALTH_STALE_AFTER_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
});

export type ApiEnvironment = z.infer<typeof baseSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema>;

export function parseApiEnvironment(input: NodeJS.ProcessEnv): ApiEnvironment {
  return validateSharedEnvironment(baseSchema.parse(input));
}

export function parseWorkerEnvironment(input: NodeJS.ProcessEnv): WorkerEnvironment {
  return validateSharedEnvironment(workerSchema.parse(input));
}

function validateSharedEnvironment<T extends ApiEnvironment>(environment: T): T {
  const issues: string[] = [];
  const authMode = environment.AUTH_MODE
    ?? (environment.NODE_ENV === 'production' ? 'supabase' : 'development');

  if (authMode === 'supabase') {
    if (!environment.SUPABASE_URL) issues.push('SUPABASE_URL is required when AUTH_MODE=supabase');
    if (!environment.SUPABASE_SECRET_KEY) issues.push('SUPABASE_SECRET_KEY is required when AUTH_MODE=supabase');
  }

  if (environment.NODE_ENV === 'production') {
    if (environment.AUTH_MODE !== 'supabase') issues.push('AUTH_MODE must be explicitly set to supabase in production');
    validatePublicHttpsUrl('SUPABASE_URL', environment.SUPABASE_URL, issues);
    validatePublicHttpsUrl('WEB_ORIGIN', environment.WEB_ORIGIN, issues);
    validatePublicHttpsUrl('WEB_URL', environment.WEB_URL, issues);
    validateDatabaseTls(environment.DATABASE_URL, issues);
    if (environment.SUPABASE_SECRET_KEY?.startsWith('sb_publishable_')) {
      issues.push('SUPABASE_SECRET_KEY cannot use a publishable key');
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid runtime environment: ${issues.join('; ')}`);
  }

  return { ...environment, AUTH_MODE: authMode };
}

function validatePublicHttpsUrl(name: string, value: string | undefined, issues: string[]): void {
  if (!value) {
    issues.push(`${name} is required in production`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') issues.push(`${name} must use https`);
    if (isLoopback(url.hostname)) issues.push(`${name} cannot use a loopback host in production`);
    if (name === 'WEB_ORIGIN' && url.origin !== value.replace(/\/$/, '')) {
      issues.push('WEB_ORIGIN must contain only the public origin');
    }
  } catch {
    issues.push(`${name} must be a valid URL`);
  }
}

function validateDatabaseTls(value: string, issues: string[]): void {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      issues.push('DATABASE_URL must use the postgres protocol');
      return;
    }
    if (url.searchParams.get('sslmode') !== 'verify-full') {
      issues.push('DATABASE_URL must set sslmode=verify-full');
    }
    if (!url.searchParams.get('sslrootcert')) {
      issues.push('DATABASE_URL must set sslrootcert');
    }
  } catch {
    issues.push('DATABASE_URL must be a valid PostgreSQL URL');
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
