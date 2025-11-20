import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config';
import { orderRoutes } from './routes/order.routes';
import { createOrderWorker } from './queue/orderProcessor';

const fastify = Fastify({
  logger: {
    level: config.server.env === 'production' ? 'info' : 'debug',
  },
});

async function start() {
  try {
    // Register WebSocket plugin
    await fastify.register(websocket);

    // Register routes
    await fastify.register(orderRoutes);

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Start queue worker
    const worker = createOrderWorker();
    console.log('[Queue] Worker started');

    worker.on('completed', (job) => {
      console.log(`[Queue] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[Queue] Job ${job?.id} failed:`, err);
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });

    console.log(` Server listening on port ${config.server.port}`);
    console.log(` Queue worker running with concurrency: ${config.queue.concurrency}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

start();



