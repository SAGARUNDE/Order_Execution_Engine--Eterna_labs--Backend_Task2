import prisma from '../db/prisma';
import { OrderType, OrderStatus } from '../utils/types';

export class OrderService {
  async createOrder(data: {
    type: OrderType;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    limitPrice?: string;
  }) {
    return prisma.order.create({
      data: {
        type: data.type,
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        amount: data.amount,
        limitPrice: data.limitPrice || null,
        status: 'pending',
      },
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, updates?: {
    dexSelected?: string;
    executedPrice?: string;
    txHash?: string;
    errorMessage?: string;
  }) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  async getOrder(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
    });
  }
}



