import { Queue } from 'bullmq';
import { config } from '../config';
import { OrderJobData } from '../utils/types';
import { createRedisClient } from '../utils/redisClient';

const redis = createRedisClient();

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


