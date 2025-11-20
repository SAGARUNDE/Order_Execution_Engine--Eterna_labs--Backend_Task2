import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrderService } from '../services/order.service';
import prisma from '../db/prisma';

describe('Database Operations', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
  });

  afterEach(async () => {
    // Clean up test orders
    await prisma.order.deleteMany({
      where: {
        tokenIn: 'TEST_TOKEN',
      },
    });
  });

  describe('Order Creation', () => {
    it('should create market order in database', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.type).toBe('market');
      expect(order.status).toBe('pending');
      expect(order.tokenIn).toBe('TEST_TOKEN');
      expect(order.tokenOut).toBe('USDC');
      expect(order.amount).toBe('100');
      expect(order.limitPrice).toBeNull();
    });

    it('should create limit order with limit price', async () => {
      const order = await orderService.createOrder({
        type: 'limit',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
        limitPrice: '1.5',
      });

      expect(order.type).toBe('limit');
      expect(order.limitPrice).toBe('1.5');
    });

    it('should create sniper order', async () => {
      const order = await orderService.createOrder({
        type: 'sniper',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      expect(order.type).toBe('sniper');
    });
  });

  describe('Order Updates', () => {
    it('should update order status', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      await orderService.updateOrderStatus(order.id, 'routing');

      const updated = await orderService.getOrder(order.id);
      expect(updated?.status).toBe('routing');
    });

    it('should update order with execution details', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      await orderService.updateOrderStatus(order.id, 'confirmed', {
        dexSelected: 'raydium',
        executedPrice: '1.05',
        txHash: '0x1234567890abcdef',
      });

      const updated = await orderService.getOrder(order.id);
      expect(updated?.status).toBe('confirmed');
      expect(updated?.dexSelected).toBe('raydium');
      expect(updated?.executedPrice).toBe('1.05');
      expect(updated?.txHash).toBe('0x1234567890abcdef');
    });

    it('should save error message on failure', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      await orderService.updateOrderStatus(order.id, 'failed', {
        errorMessage: 'Execution failed: insufficient liquidity',
      });

      const updated = await orderService.getOrder(order.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.errorMessage).toBe('Execution failed: insufficient liquidity');
    });
  });

  describe('Order Retrieval', () => {
    it('should retrieve order by ID', async () => {
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'TEST_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      const retrieved = await orderService.getOrder(order.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(order.id);
    });

    it('should return null for non-existent order', async () => {
      const retrieved = await orderService.getOrder('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });
});



