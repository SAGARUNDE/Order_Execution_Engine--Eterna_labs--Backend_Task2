import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketOrderService } from '../services/marketOrder.service';
import { LimitOrderService } from '../services/limitOrder.service';
import { SniperOrderService } from '../services/sniperOrder.service';
import { MockDexRouter } from '../dex/mockDexRouter';
import { OrderService } from '../services/order.service';
import { WebSocketEmitter } from '../ws/websocketHandler';
import prisma from '../db/prisma';

describe('Order Flow', () => {
  let router: MockDexRouter;
  let orderService: OrderService;
  let wsEmitter: WebSocketEmitter;
  let marketService: MarketOrderService;
  let limitService: LimitOrderService;
  let sniperService: SniperOrderService;

  beforeEach(() => {
    router = new MockDexRouter(1.0);
    orderService = new OrderService();
    wsEmitter = new WebSocketEmitter();
    marketService = new MarketOrderService(router, orderService, wsEmitter);
    limitService = new LimitOrderService(router, orderService, wsEmitter);
    sniperService = new SniperOrderService(router, orderService, wsEmitter);
  });

  describe('Market Order Lifecycle', () => {
    it('should execute market order through all lifecycle stages', async () => {
      // Create order
      const order = await orderService.createOrder({
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
      });

      // Mock WebSocket emit to track events
      const events: string[] = [];
      const originalEmit = wsEmitter.emit.bind(wsEmitter);
      wsEmitter.emit = (orderId: string, status: string) => {
        if (orderId === order.id) {
          events.push(status);
        }
        return originalEmit(orderId, status as any, {});
      };

      // Process order
      await marketService.processMarketOrder({
        orderId: order.id,
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
      });

      // Verify order in database
      const updatedOrder = await orderService.getOrder(order.id);
      expect(updatedOrder?.status).toBe('confirmed');
      expect(updatedOrder?.dexSelected).toBeDefined();
      expect(updatedOrder?.txHash).toBeDefined();
      expect(updatedOrder?.executedPrice).toBeDefined();

      // Verify lifecycle events (at least the main ones)
      expect(events).toContain('routing');
      expect(events).toContain('building');
      expect(events).toContain('submitted');
      expect(events).toContain('confirmed');

      // Cleanup
      await prisma.order.delete({ where: { id: order.id } });
    });
  });

  describe('Limit Order - Waits for Price Condition', () => {
    it('should wait until price condition is met', async () => {
      // Create a router with a price that will eventually meet condition
      const highPriceRouter = new MockDexRouter(1.1); // Base price 1.1
      
      const limitService = new LimitOrderService(
        highPriceRouter,
        orderService,
        wsEmitter
      );

      const order = await orderService.createOrder({
        type: 'limit',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
        limitPrice: '1.0', // Limit price 1.0, current price ~1.1, so condition should be met
      });

      const events: string[] = [];
      const originalEmit = wsEmitter.emit.bind(wsEmitter);
      wsEmitter.emit = (orderId: string, status: string) => {
        if (orderId === order.id) {
          events.push(status);
        }
        return originalEmit(orderId, status as any, {});
      };

      // Process order (should execute quickly since price condition is met)
      await limitService.processLimitOrder({
        orderId: order.id,
        type: 'limit',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
        limitPrice: '1.0',
      });

      // Verify order executed
      const updatedOrder = await orderService.getOrder(order.id);
      expect(updatedOrder?.status).toBe('confirmed');
      expect(events).toContain('waiting_for_trigger');
      expect(events).toContain('routing');

      // Cleanup
      await prisma.order.delete({ where: { id: order.id } });
    }, 30000); // Increase timeout for limit order
  });

  describe('Sniper Order - Waits for Token Availability', () => {
    it('should execute when token becomes available', async () => {
      const order = await orderService.createOrder({
        type: 'sniper',
        tokenIn: 'NEW_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      const events: string[] = [];
      const originalEmit = wsEmitter.emit.bind(wsEmitter);
      wsEmitter.emit = (orderId: string, status: string) => {
        if (orderId === order.id) {
          events.push(status);
        }
        return originalEmit(orderId, status as any, {});
      };

      // Process order (should execute since token is available via mock)
      await sniperService.processSniperOrder({
        orderId: order.id,
        type: 'sniper',
        tokenIn: 'NEW_TOKEN',
        tokenOut: 'USDC',
        amount: '100',
      });

      // Verify order executed
      const updatedOrder = await orderService.getOrder(order.id);
      expect(updatedOrder?.status).toBe('confirmed');
      expect(events).toContain('scanning_launch');
      expect(events).toContain('routing');

      // Cleanup
      await prisma.order.delete({ where: { id: order.id } });
    }, 30000);
  });
});



