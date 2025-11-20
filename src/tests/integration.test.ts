import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import prisma from '../db/prisma';

describe('Integration Tests', () => {
  let orderController: OrderController;
  let orderService: OrderService;

  beforeEach(() => {
    orderController = new OrderController();
    orderService = new OrderService();
  });

  afterEach(async () => {
    await prisma.order.deleteMany({
      where: {
        tokenIn: 'TEST_TOKEN',
      },
    });
  });

  describe('End-to-End Order Execution', () => {
    it('should create order and add to queue', async () => {
      const mockRequest = {
        body: {
          type: 'market',
          tokenIn: 'TEST_TOKEN',
          tokenOut: 'USDC',
          amount: '100',
        },
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        sent: false,
      };

      await orderController.executeOrder(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
      
      const response = mockReply.send.mock.calls[0][0];
      expect(response).toHaveProperty('orderId');

      // Verify order in database
      const order = await orderService.getOrder(response.orderId);
      expect(order).toBeDefined();
      expect(order?.type).toBe('market');
    });

    it('should validate limit price for limit orders', async () => {
      const mockRequest = {
        body: {
          type: 'limit',
          tokenIn: 'TEST_TOKEN',
          tokenOut: 'USDC',
          amount: '100',
          // Missing limitPrice
        },
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        sent: false,
      };

      await orderController.executeOrder(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      const response = mockReply.send.mock.calls[0][0];
      expect(response.error).toContain('limitPrice');
    });
  });
});

