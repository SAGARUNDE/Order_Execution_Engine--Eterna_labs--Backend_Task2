import { OrderStatus, OrderType, WebSocketMessage } from '../utils/types';
import { createWebSocketMessage } from '../utils/websocket';

// WebSocket-like interface that works with both ws library and Fastify WebSocket
interface WebSocketLike {
  send(data: string): void;
  readyState: number;
  on?(event: string, callback: (...args: any[]) => void): void;
  close?(code?: number, reason?: string): void;
}

export class WebSocketEmitter {
  private connections: Map<string, Set<WebSocketLike>> = new Map();
  private orderTypes: Map<string, OrderType> = new Map();
  private history: Map<string, WebSocketMessage[]> = new Map();
  private historyTimestamps: Map<string, number> = new Map();
  private readonly HISTORY_LIMIT = 50;
  private readonly HISTORY_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Register a WebSocket connection for an order
   */
  register(orderId: string, ws: WebSocketLike, orderType?: OrderType): void {
    if (!ws) {
      console.error(`[WebSocket] Cannot register: ws is undefined for order ${orderId}`);
      return;
    }

    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }
    this.connections.get(orderId)!.add(ws);

    if (orderType) {
      this.orderTypes.set(orderId, orderType);
    }

    // Note: Close handler is set up in the route handler, not here
    // This avoids issues with different WebSocket implementations
  }

  /**
   * Replay historical messages for a connection
   */
  replayHistory(orderId: string, ws: WebSocketLike): number {
    const history = this.history.get(orderId);
    if (!history || history.length === 0) {
      return 0;
    }

    const OPEN = 1;
    if (ws.readyState !== OPEN) {
      return 0;
    }

    history.forEach(message => {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WebSocket] Error replaying history to order ${orderId}:`, error);
      }
    });

    return history.length;
  }

  hasHistory(orderId: string): boolean {
    return (this.history.get(orderId)?.length || 0) > 0;
  }

  /**
   * Unregister a WebSocket connection
   */
  unregister(orderId: string, ws: WebSocketLike): void {
    const connections = this.connections.get(orderId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(orderId);
      }
    }
  }

  /**
   * Emit a message to all connections for an order
   */
  emit(orderId: string, status: OrderStatus, details?: any): void {
    // Get order type from details, stored type, or default
    const orderType = details?.type || this.orderTypes.get(orderId) || 'market' as OrderType;
    
    // Store order type if provided
    if (details?.type) {
      this.orderTypes.set(orderId, details.type);
    }

    const message = createWebSocketMessage(orderId, status, orderType, details);

    // Store in history for future subscribers
    this.appendToHistory(orderId, message);

    const connections = this.connections.get(orderId);
    if (!connections || connections.size === 0) {
      // No active connections, but history is stored for future playback
      return;
    }

    // Send to all connections
    // WebSocket.OPEN = 1 (from ws library)
    const OPEN = 1;
    connections.forEach(ws => {
      if (ws.readyState === OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`[WebSocket] Error sending message to order ${orderId}:`, error);
          // Remove connection on error
          this.unregister(orderId, ws);
        }
      } else {
        // Remove closed connections
        this.unregister(orderId, ws);
      }
    });
  }

  /**
   * Get active connections count for an order
   */
  getConnectionCount(orderId: string): number {
    return this.connections.get(orderId)?.size || 0;
  }

  private appendToHistory(orderId: string, message: WebSocketMessage): void {
    const existing = this.history.get(orderId) ?? [];
    existing.push(message);

    while (existing.length > this.HISTORY_LIMIT) {
      existing.shift();
    }

    this.history.set(orderId, existing);
    this.historyTimestamps.set(orderId, Date.now());
    this.cleanupHistory();
  }

  private cleanupHistory(): void {
    const now = Date.now();
    for (const [orderId, timestamp] of this.historyTimestamps.entries()) {
      if (now - timestamp > this.HISTORY_TTL_MS) {
        if (!this.connections.has(orderId)) {
          this.history.delete(orderId);
          this.orderTypes.delete(orderId);
          this.historyTimestamps.delete(orderId);
        }
      }
    }
  }
}

// Singleton instance
export const wsEmitter = new WebSocketEmitter();

