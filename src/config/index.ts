import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/eterna_orders?schema=public',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  order: {
    limitOrderTimeoutMinutes: parseInt(process.env.LIMIT_ORDER_TIMEOUT_MINUTES || '30', 10),
    sniperPollIntervalMs: parseInt(process.env.SNIPER_POLL_INTERVAL_MS || '1000', 10),
    dexQuotePollIntervalMs: parseInt(process.env.DEX_QUOTE_POLL_INTERVAL_MS || '1000', 10),
  },
  queue: {
    name: 'order-exec-queue',
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3', 10),
    lockDurationMs: parseInt(process.env.QUEUE_LOCK_DURATION_MS || '300000', 10), // 5 minutes
    stalledIntervalMs: parseInt(process.env.QUEUE_STALLED_INTERVAL_MS || '60000', 10), // 1 minute
    maxStalledRetries: parseInt(process.env.QUEUE_MAX_STALLED_RETRIES || '3', 10),
  },
};



