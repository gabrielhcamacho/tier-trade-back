import { parseApiEnvironment, parseWorkerEnvironment } from './runtime-environment.js';

const target = process.env.TIER_TRADE_PROCESS ?? 'api';
if (target === 'api') parseApiEnvironment(process.env);
else if (target === 'worker') parseWorkerEnvironment(process.env);
else throw new Error('TIER_TRADE_PROCESS must be api or worker');

console.info(JSON.stringify({
  event: 'runtime.environment.valid',
  target,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  authMode: process.env.AUTH_MODE ?? 'default',
}));
