import { FastifyInstance } from "fastify";
import { OrderController } from "../controllers/order.controller";
import { wsEmitter } from "../ws/websocketHandler";
import { OrderService } from "../services/order.service";

const orderController = new OrderController();
const orderService = new OrderService();

export async function orderRoutes(fastify: FastifyInstance) {
  // POST /api/orders/execute - Create order
  fastify.post("/api/orders/execute", async (request, reply) => {
    return orderController.executeOrder(request as any, reply);
  });

  // WebSocket endpoint for order status
  // Client should: 1) POST /api/orders/execute, 2) GET /api/orders/:orderId/ws
  fastify.get(
    "/api/orders/:orderId/ws",
    { websocket: true },
    async (connection, req) => {
      // In Fastify WebSocket, the connection parameter IS the WebSocket socket itself
      // Validate connection exists and is ready
      if (!connection || connection.readyState !== 1) {
        const params = (req.params as { orderId?: string }) ?? {};
        const query = (req.query as { orderId?: string }) ?? {};
        const orderId = params.orderId || query.orderId;
        console.error(`[WebSocket] Connection is not ready for order ${orderId || 'unknown'}. ReadyState: ${connection?.readyState}`);
        return;
      }

      const params = (req.params as { orderId?: string }) ?? {};
      const query = (req.query as { orderId?: string }) ?? {};
      const orderId = params.orderId || query.orderId;

      if (!orderId) {
        connection.close(1008, "Order ID required in path or query string");
        return;
      }

      // Fetch order to get type
      const order = await orderService.getOrder(orderId);
      if (!order) {
        console.log(`[WebSocket] Order not found: ${orderId}`);
        connection.close(1008, "Order not found");
        return;
      }

      console.log(`[WebSocket] Client connected for order ${orderId} (type: ${order.type}, status: ${order.status})`);

      // Register WebSocket connection with order type
      // connection IS the socket in Fastify WebSocket
      wsEmitter.register(orderId, connection as any, order.type as any);

      // Replay any historical messages so late subscribers see full lifecycle
      const replayedCount = wsEmitter.replayHistory(orderId, connection as any);
      if (replayedCount > 0) {
        console.log(`[WebSocket] Replayed ${replayedCount} messages for order ${orderId}`);
      } else {
        // If no history exists, send current order status immediately
        // This ensures clients connecting after order creation still get the current state
        const currentStatus = order.status as any;
        wsEmitter.emit(orderId, currentStatus, {
          type: order.type as any,
          message: "Connected to order stream",
          ...(order.dexSelected && { dex: order.dexSelected }),
          ...(order.txHash && { txHash: order.txHash }),
          ...(order.executedPrice && { executedPrice: order.executedPrice }),
        });
        console.log(`[WebSocket] Sent current status (${currentStatus}) to order ${orderId}`);
      }

      // Handle client messages
      connection.on("message", (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "ping") {
            connection.send(JSON.stringify({ type: "pong" }));
          }
        } catch (error) {
          // Ignore invalid messages
        }
      });

      // Handle close event - unregister connection
      connection.on("close", () => {
        console.log(`[WebSocket] Client disconnected for order ${orderId}`);
        wsEmitter.unregister(orderId, connection as any);
      });
    }
  );
}
