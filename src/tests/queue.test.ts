import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { config } from '../config';
import { orderQueue } from '../queue/queue';
import { OrderService } from '../services/order.service';
import prisma from '../db/prisma';

describe('Queue Logic', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
  });

  describe('Queue Job Addition', () => {
    it('should add order job to queue', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
      });

      const job = await orderQueue.add(
        `order-${order.id}`,
        {
          orderId: order.id,
          type: 'market',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: '100',
        },
        {
          jobId: order.id,
        }
      );

      expect(job).toBeDefined();
      expect(job.id).toBe(order.id);
      expect(job.data.orderId).toBe(order.id);

      // Cleanup
      await job.remove();
      await prisma.order.delete({ where: { id: order.id } });
    });
  });

  describe('Queue Configuration', () => {
    it('should have correct concurrency setting', () => {
      expect(config.queue.concurrency).toBe(10);
    });

    it('should have correct max attempts setting', () => {
      expect(config.queue.maxAttempts).toBe(3);
    });
  });
});

