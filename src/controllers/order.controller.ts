import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrderService } from '../services/order.service';
import { orderQueue } from '../queue/queue';
import { wsEmitter } from '../ws/websocketHandler';
import { CreateOrderRequest } from '../utils/types';

const createOrderSchema = z.object({
  type: z.enum(['market', 'limit', 'sniper']),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  limitPrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  async executeOrder(req: FastifyRequest<{ Body: CreateOrderRequest }>, reply: FastifyReply) {
    try {
      // Validate input
      const validated = createOrderSchema.parse(req.body);

      // Validate limit price for limit orders
      if (validated.type === 'limit' && !validated.limitPrice) {
        return reply.status(400).send({
          error: 'limitPrice is required for limit orders',
        });
      }

      // Create order in database
      const order = await this.orderService.createOrder({
        type: validated.type,
        tokenIn: validated.tokenIn,
        tokenOut: validated.tokenOut,
        amount: validated.amount,
        limitPrice: validated.limitPrice,
      });

      // Add job to queue
      await orderQueue.add(
        `order-${order.id}`,
        {
          orderId: order.id,
          type: order.type as 'market' | 'limit' | 'sniper',
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amount: order.amount,
          limitPrice: order.limitPrice || undefined,
        },
        {
          jobId: order.id, // Use order ID as job ID for uniqueness
        }
      );

      // Return order ID
      return reply.status(200).send({
        orderId: order.id,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      console.error('[OrderController] Error executing order:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
}



