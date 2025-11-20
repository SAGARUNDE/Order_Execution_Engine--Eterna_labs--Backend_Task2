import { MockDexRouter } from '../dex/mockDexRouter';
import { config } from '../config';
import { OrderJobData, OrderType } from '../utils/types';
import { OrderService } from './order.service';
import { WebSocketEmitter } from '../ws/websocketHandler';

export class SniperOrderService {
  private router: MockDexRouter;
  private orderService: OrderService;
  private wsEmitter: WebSocketEmitter;

  constructor(router: MockDexRouter, orderService: OrderService, wsEmitter: WebSocketEmitter) {
    this.router = router;
    this.orderService = orderService;
    this.wsEmitter = wsEmitter;
  }

  async processSniperOrder(data: OrderJobData): Promise<void> {
    const { orderId, tokenIn, tokenOut, amount, type } = data;

    // Emit scanning_launch status
    await this.orderService.updateOrderStatus(orderId, 'scanning_launch');
    this.wsEmitter.emit(orderId, 'scanning_launch', {
      type,
      message: 'Scanning for token availability...',
    });

    // Poll until token becomes available
    while (true) {
      try {
        // Check if token is available (any DEX returns valid quote)
        const isAvailable = await this.router.checkTokenAvailability(tokenIn, tokenOut);

        if (isAvailable) {
          // Get quotes and select best DEX
          const amountNum = parseFloat(amount);
          const quotes = await this.router.getAllQuotes(amountNum);
          const bestQuote = this.router.selectBestDex(quotes);

          // Execute immediately
          await this.executeOrder(orderId, tokenIn, tokenOut, amount, bestQuote.dex, type);
          return;
        }

        // Wait before next poll
        await this.delay(config.order.sniperPollIntervalMs);
      } catch (error) {
        console.error(`[SniperOrder] Error checking availability for order ${orderId}:`, error);
        await this.delay(config.order.sniperPollIntervalMs);
      }
    }
  }

  private async executeOrder(
    orderId: string,
    tokenIn: string,
    tokenOut: string,
    amount: string,
    dex: 'raydium' | 'meteora',
    type: OrderType = 'sniper'
  ): Promise<void> {
    try {
      // Update to routing
      await this.orderService.updateOrderStatus(orderId, 'routing', { dexSelected: dex });
      this.wsEmitter.emit(orderId, 'routing', { type, dex });

      // Build transaction
      await this.orderService.updateOrderStatus(orderId, 'building');
      this.wsEmitter.emit(orderId, 'building', { type });

      // Execute swap
      const swapResult = await this.router.executeSwap(dex, { tokenIn, tokenOut, amount });

      // Submit
      await this.orderService.updateOrderStatus(orderId, 'submitted', {
        txHash: swapResult.txHash,
      });
      this.wsEmitter.emit(orderId, 'submitted', {
        type,
        txHash: swapResult.txHash,
      });

      // Confirm
      await this.orderService.updateOrderStatus(orderId, 'confirmed', {
        executedPrice: swapResult.executedPrice.toString(),
      });
      this.wsEmitter.emit(orderId, 'confirmed', {
        type,
        txHash: swapResult.txHash,
        executedPrice: swapResult.executedPrice,
      });
    } catch (error: any) {
      await this.orderService.updateOrderStatus(orderId, 'failed', {
        errorMessage: error.message || 'Failed to execute sniper order',
      });
      this.wsEmitter.emit(orderId, 'failed', {
        type,
        error: error.message || 'Failed to execute sniper order',
      });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

