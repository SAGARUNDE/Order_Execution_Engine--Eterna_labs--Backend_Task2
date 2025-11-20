import { MockDexRouter } from '../dex/mockDexRouter';
import { OrderJobData } from '../utils/types';
import { OrderService } from './order.service';
import { WebSocketEmitter } from '../ws/websocketHandler';

export class MarketOrderService {
  private router: MockDexRouter;
  private orderService: OrderService;
  private wsEmitter: WebSocketEmitter;

  constructor(router: MockDexRouter, orderService: OrderService, wsEmitter: WebSocketEmitter) {
    this.router = router;
    this.orderService = orderService;
    this.wsEmitter = wsEmitter;
  }

  async processMarketOrder(data: OrderJobData): Promise<void> {
    const { orderId, tokenIn, tokenOut, amount, type } = data;

    try {
      const amountNum = parseFloat(amount);

      // Get quotes from all DEXes
      await this.orderService.updateOrderStatus(orderId, 'routing');
      this.wsEmitter.emit(orderId, 'routing', { type });

      const quotes = await this.router.getAllQuotes(amountNum);
      const bestQuote = this.router.selectBestDex(quotes);

      // Update with selected DEX
      await this.orderService.updateOrderStatus(orderId, 'routing', {
        dexSelected: bestQuote.dex,
      });
      this.wsEmitter.emit(orderId, 'routing', { type, dex: bestQuote.dex });

      // Build transaction
      await this.orderService.updateOrderStatus(orderId, 'building');
      this.wsEmitter.emit(orderId, 'building', { type });

      // Execute swap
      const swapResult = await this.router.executeSwap(bestQuote.dex, { tokenIn, tokenOut, amount });

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
        errorMessage: error.message || 'Failed to execute market order',
      });
      this.wsEmitter.emit(orderId, 'failed', {
        type,
        error: error.message || 'Failed to execute market order',
      });
      throw error;
    }
  }
}

