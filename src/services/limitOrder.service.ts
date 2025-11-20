import { Job } from 'bullmq';
import { MockDexRouter } from '../dex/mockDexRouter';
import { config } from '../config';
import { OrderJobData, OrderType } from '../utils/types';
import { OrderService } from './order.service';
import { WebSocketEmitter } from '../ws/websocketHandler';

export class LimitOrderService {
  private router: MockDexRouter;
  private orderService: OrderService;
  private wsEmitter: WebSocketEmitter;

  constructor(router: MockDexRouter, orderService: OrderService, wsEmitter: WebSocketEmitter) {
    this.router = router;
    this.orderService = orderService;
    this.wsEmitter = wsEmitter;
  }

  async processLimitOrder(job: Job<OrderJobData>): Promise<void> {
    const { orderId, tokenIn, tokenOut, amount, limitPrice, type } = job.data;
    
    if (!limitPrice) {
      throw new Error('Limit price is required for limit orders');
    }

    const limitPriceNum = parseFloat(limitPrice);
    const amountNum = parseFloat(amount);
    const startTime = Date.now();
    const timeoutMs = config.order.limitOrderTimeoutMinutes * 60 * 1000;

    // Emit waiting_for_trigger status
    await this.orderService.updateOrderStatus(orderId, 'waiting_for_trigger');
    this.wsEmitter.emit(orderId, 'waiting_for_trigger', {
      type,
      limitPrice: limitPriceNum,
    });

    // Poll for price condition
    while (true) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        await this.orderService.updateOrderStatus(orderId, 'failed', {
          errorMessage: 'Limit order timeout: price condition not met within timeout period',
        });
        this.wsEmitter.emit(orderId, 'failed', {
          type,
          error: 'Limit order timeout: price condition not met within timeout period',
        });
        return;
      }

      try {
        // Get quotes from all DEXes
        const quotes = await this.router.getAllQuotes(amountNum);
        const bestQuote = this.router.selectBestDex(quotes);
        const currentPrice = bestQuote.price;

        // Check if price condition is met
        // For selling: currentPrice >= limitPrice
        // For buying: currentPrice <= limitPrice
        // We'll assume selling for now (can be enhanced with direction)
        const conditionMet = currentPrice >= limitPriceNum;

        if (conditionMet) {
          // Execute the order with the quote price to ensure executed price matches the quote
          // This prevents executed price from being below the limit price
          await this.executeOrder(orderId, tokenIn, tokenOut, amount, bestQuote.dex, type, bestQuote.price, limitPriceNum);
          return;
        }

        // Wait before next poll
        await job.updateProgress({
          state: 'waiting_for_trigger',
          currentPrice,
          limitPrice: limitPriceNum,
        });
        await this.delay(config.order.dexQuotePollIntervalMs);
      } catch (error) {
        console.error(`[LimitOrder] Error polling quotes for order ${orderId}:`, error);
        await this.delay(config.order.dexQuotePollIntervalMs);
      }
    }
  }

  private async executeOrder(
    orderId: string,
    tokenIn: string,
    tokenOut: string,
    amount: string,
    dex: 'raydium' | 'meteora',
    type: OrderType = 'limit',
    quotePrice: number,
    limitPrice: number
  ): Promise<void> {
    try {
      // Update to routing
      await this.orderService.updateOrderStatus(orderId, 'routing', { dexSelected: dex });
      this.wsEmitter.emit(orderId, 'routing', { type, dex });

      // Build transaction
      await this.orderService.updateOrderStatus(orderId, 'building');
      this.wsEmitter.emit(orderId, 'building', { type });

      // Execute swap with quote price to ensure executed price matches the quote that met the limit condition
      const swapResult = await this.router.executeSwap(dex, { tokenIn, tokenOut, amount }, quotePrice);

      // Validate executed price meets limit condition (safety check)
      // For selling: executedPrice >= limitPrice
      if (swapResult.executedPrice < limitPrice) {
        const errorMsg = `Executed price ${swapResult.executedPrice} is below limit price ${limitPrice}`;
        console.error(`[LimitOrder] ${errorMsg} for order ${orderId}`);
        await this.orderService.updateOrderStatus(orderId, 'failed', {
          errorMessage: errorMsg,
        });
        this.wsEmitter.emit(orderId, 'failed', {
          type,
          error: errorMsg,
        });
        throw new Error(errorMsg);
      }

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
        errorMessage: error.message || 'Failed to execute limit order',
      });
      this.wsEmitter.emit(orderId, 'failed', {
        type,
        error: error.message || 'Failed to execute limit order',
      });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

