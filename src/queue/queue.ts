import { Queue } from 'bullmq';
import { config } from '../config';
import { OrderJobData } from '../utils/types';
import Redis from 'ioredis';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
});

export const orderQueue = new Queue<OrderJobData>(config.queue.name, {
  connection: redis,
  defaultJobOptions: {
    attempts: config.queue.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
});


