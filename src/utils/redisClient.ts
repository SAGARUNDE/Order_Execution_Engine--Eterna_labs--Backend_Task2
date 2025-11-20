import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';

export function createRedisClient(): Redis {
  const baseOptions: RedisOptions = {
    maxRetriesPerRequest: null,
  };

  if (config.redis.url) {
    return new Redis(config.redis.url, baseOptions);
  }

  const connectionOptions: RedisOptions = {
    ...baseOptions,
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    username: config.redis.username,
  };

  if (config.redis.useTls) {
    connectionOptions.tls = {
      rejectUnauthorized: config.redis.tlsRejectUnauthorized,
    };
  }

  return new Redis(connectionOptions);
}

