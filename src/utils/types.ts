export type OrderType = 'market' | 'limit' | 'sniper';

export type OrderStatus = 
  | 'pending'
  | 'waiting_for_trigger'
  | 'scanning_launch'
  | 'routing'
  | 'building'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface CreateOrderRequest {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  limitPrice?: string; // Required for limit orders
}

export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  type: OrderType;
  details?: {
    dex?: string;
    price?: number;
    txHash?: string;
    error?: string;
    [key: string]: any;
  };
}

export interface OrderJobData {
  orderId: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  limitPrice?: string;
}



