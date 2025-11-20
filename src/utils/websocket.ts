import { WebSocketMessage, OrderStatus, OrderType } from './types';

export function createWebSocketMessage(
  orderId: string,
  status: OrderStatus,
  type: OrderType,
  details?: WebSocketMessage['details']
): WebSocketMessage {
  return {
    orderId,
    status,
    timestamp: new Date().toISOString(),
    type,
    details,
  };
}



