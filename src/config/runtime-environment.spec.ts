import { describe, expect, it } from 'vitest';
import { parseApiEnvironment, parseWorkerEnvironment } from './runtime-environment.js';

const productionEnvironment = {
  NODE_ENV: 'production',
  AUTH_MODE: 'supabase',
  DATABASE_URL: 'postgresql://runtime:secret@db.example.com:5432/postgres?sslmode=verify-full&sslrootcert=%2Fetc%2Fssl%2Fsupabase.crt',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_server_only',
  WEB_ORIGIN: 'https://trade.example.com',
  WEB_URL: 'https://trade.example.com',
};

describe('runtime environment', () => {
  it('accepts a hardened production API environment', () => {
    expect(parseApiEnvironment(productionEnvironment)).toMatchObject({
      NODE_ENV: 'production',
      AUTH_MODE: 'supabase',
      PORT: 3001,
      DATABASE_POOL_MAX: 5,
      DATABASE_IDLE_TIMEOUT_MS: 30_000,
      DATABASE_CONNECTION_TIMEOUT_MS: 10_000,
    });
  });

  it('accepts bounded database pool settings', () => {
    expect(parseApiEnvironment({
      ...productionEnvironment,
      DATABASE_POOL_MAX: '3',
      DATABASE_IDLE_TIMEOUT_MS: '15000',
      DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    })).toMatchObject({
      DATABASE_POOL_MAX: 3,
      DATABASE_IDLE_TIMEOUT_MS: 15_000,
      DATABASE_CONNECTION_TIMEOUT_MS: 5_000,
    });
  });

  it('rejects unsafe database pool settings', () => {
    expect(() => parseApiEnvironment({
      ...productionEnvironment,
      DATABASE_POOL_MAX: '100',
    })).toThrow();
  });

  it('rejects development auth and loopback URLs in production', () => {
    expect(() => parseApiEnvironment({
      ...productionEnvironment,
      AUTH_MODE: 'development',
      WEB_ORIGIN: 'http://localhost:3000',
    })).toThrow(/AUTH_MODE must be explicitly set to supabase.*WEB_ORIGIN must use https.*loopback/);
  });

  it('rejects encrypted transport without hostname and CA validation', () => {
    expect(() => parseApiEnvironment({
      ...productionEnvironment,
      DATABASE_URL: 'postgresql://runtime:secret@db.example.com/postgres?sslmode=require',
    })).toThrow(/sslmode=verify-full.*sslrootcert/);
  });

  it('requires server-side Supabase credentials in Supabase mode', () => {
    expect(() => parseApiEnvironment({
      NODE_ENV: 'development',
      AUTH_MODE: 'supabase',
      DATABASE_URL: 'postgresql://localhost/tier_trade',
    })).toThrow(/SUPABASE_URL.*SUPABASE_SECRET_KEY/);
  });

  it('requires a tenant for each worker process', () => {
    expect(() => parseWorkerEnvironment(productionEnvironment)).toThrow();
    expect(parseWorkerEnvironment({
      ...productionEnvironment,
      TENANT_ID: '11111111-1111-4111-8111-111111111111',
    }).OUTBOX_BATCH_SIZE).toBe(25);
  });
});
