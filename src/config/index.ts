import dotenv from 'dotenv';

dotenv.config();

const defaultRedisHost = process.env.REDIS_HOST || 'localhost';
const defaultRedisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const defaultRedisPassword = process.env.REDIS_PASSWORD || undefined;
const defaultRedisUsername = process.env.REDIS_USERNAME || undefined;
const redisUrl = process.env.REDIS_URL || undefined;
const redisTlsEnabled = process.env.REDIS_TLS === 'true';
const redisTlsRejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false';

const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL || undefined;
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN || undefined;

const redisConfig = {
  host: defaultRedisHost,
  port: defaultRedisPort,
  password: defaultRedisPassword,
  username: defaultRedisUsername,
  url: redisUrl,
  useTls: redisTlsEnabled,
  tlsRejectUnauthorized: redisTlsRejectUnauthorized,
};

if (!redisConfig.url && upstashRestUrl && upstashRestToken) {
  const parsed = new URL(upstashRestUrl);
  redisConfig.host = parsed.hostname;
  redisConfig.port = parsed.port ? parseInt(parsed.port, 10) : 6379;
  redisConfig.password = upstashRestToken;
  redisConfig.username = 'default';
  redisConfig.useTls = true;
  redisConfig.tlsRejectUnauthorized = process.env.UPSTASH_REDIS_TLS_REJECT_UNAUTHORIZED !== 'false';
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://user:password@localhost:5432/eterna_orders?schema=public',
  },
  redis: redisConfig,
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
