import { Job, Worker } from "bullmq";
import { config } from "../config";
import { OrderJobData } from "../utils/types";
import { MockDexRouter } from "../dex/mockDexRouter";
import { OrderService } from "../services/order.service";
import { MarketOrderService } from "../services/marketOrder.service";
import { LimitOrderService } from "../services/limitOrder.service";
import { SniperOrderService } from "../services/sniperOrder.service";
import { wsEmitter } from "../ws/websocketHandler";
import { createRedisClient } from "../utils/redisClient";

const redis = createRedisClient();

// Initialize services
const router = new MockDexRouter(1.0);
const orderService = new OrderService();
const marketOrderService = new MarketOrderService(
  router,
  orderService,
  wsEmitter
);
const limitOrderService = new LimitOrderService(
  router,
  orderService,
  wsEmitter
);
const sniperOrderService = new SniperOrderService(
  router,
  orderService,
  wsEmitter
);

export async function processOrderJob(job: Job<OrderJobData>): Promise<void> {
  const { orderId, type, tokenIn, tokenOut, amount, limitPrice } = job.data;

  console.log(`[Queue] Processing ${type} order ${orderId}`);

  try {
    console.log(`[Queue] Starting to process ${type} order ${orderId}`);
    // Update order type in WebSocket emitter context
    wsEmitter.emit(orderId, "pending", { type: type as any });

    // Route to appropriate service based on order type
    switch (type) {
      case "market":
        await marketOrderService.processMarketOrder(job.data);
        break;
      case "limit":
        await limitOrderService.processLimitOrder(job);
        break;
      case "sniper":
        await sniperOrderService.processSniperOrder(job.data);
        break;
      default:
        throw new Error(`Unknown order type: ${type}`);
    }

    console.log(`[Queue] Successfully processed ${type} order ${orderId}`);
  } catch (error: any) {
    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts = job.opts.attempts ?? config.queue.maxAttempts;
    const attemptNumber = attemptsMade + 1;
    const isFinalAttempt = attemptNumber >= maxAttempts;

    console.error(
      `[Queue] Error processing order ${orderId} (attempt ${attemptNumber}/${maxAttempts}):`,
      error
    );

    if (isFinalAttempt) {
      // Update order status to failed only after exhausting retries
      await orderService.updateOrderStatus(orderId, "failed", {
        errorMessage: error.message || "Order processing failed",
      });

      // Emit failed status via WebSocket
      wsEmitter.emit(orderId, "failed", {
        error: error.message || "Order processing failed",
      });
    } else {
      console.warn(
        `[Queue] Retrying order ${orderId} in exponential backoff (next attempt ${
          attemptNumber + 1
        }/${maxAttempts})`
      );
    }

    throw error; // Re-throw to trigger retry logic
  }
}

// Create worker
export function createOrderWorker() {
  return new Worker<OrderJobData>(
    config.queue.name,
    async (job) => {
      return processOrderJob(job);
    },
    {
      connection: redis,
      concurrency: config.queue.concurrency,
      lockDuration: config.queue.lockDurationMs,
      stalledInterval: config.queue.stalledIntervalMs,
      maxStalledCount: config.queue.maxStalledRetries,
      useWorkerThreads: false,
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 24 * 3600, // Keep failed jobs for 24 hours
      },
    }
  );
}
