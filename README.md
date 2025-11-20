# Eterna Labs Order Execution Engine

A complete TypeScript backend system for executing cryptocurrency orders with support for Market, Limit, and Sniper order types. The system features real-time WebSocket updates, DEX routing, queue-based processing, and comprehensive testing.

## 🚀 Features

- **Three Order Types**:

  - **Market Order**: Immediate execution at best available price
  - **Limit Order**: Execute only when price condition is met
  - **Sniper Order**: Execute when token becomes available (launch detection)

- **Real-time Updates**: WebSocket streaming of order lifecycle events
- **DEX Routing**: Automatic selection of best DEX (Raydium/Meteora) based on effective price
- **Queue System**: BullMQ-based job processing with retry logic and concurrency control
- **PostgreSQL**: Persistent order storage with Prisma ORM
- **Redis**: Queue backend and active order tracking
- **Comprehensive Testing**: 12+ unit and integration tests

## 📋 Table of Contents

- [Architecture](#architecture)
- [Order Types & Flow](#order-types--flow)
- [HTTP → WebSocket Integration](#http--websocket-integration)
- [DEX Routing](#dex-routing)
- [Queue & Retry Logic](#queue--retry-logic)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─ POST /api/orders/execute
       │
       └─ WS /api/orders/:orderId/ws
              │
              ▼
       ┌─────────────┐
       │   Fastify   │
       │   Server    │
       └──────┬──────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
  ┌────────┐  ┌──────────┐
  │  Queue │  │ WebSocket│
  │(BullMQ)│  │ Emitter  │
  └────┬───┘  └──────────┘
       │
       ▼
  ┌─────────────┐
  │   Workers   │
  │ (Order      │
  │  Processors)│
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│  DEX   │ │ Database │
│ Router │ │(Postgres)│
└────────┘ └──────────┘
```

## 📊 Order Types & Flow

### Market Order

**Flow**: `pending → routing → building → submitted → confirmed/failed`

1. Order created with status `pending`
2. System routes to best DEX (`routing`)
3. Transaction built (`building`)
4. Swap executed and submitted (`submitted`)
5. Transaction confirmed (`confirmed`)

**Use Case**: Immediate execution at current market price

### Limit Order

**Flow**: `pending → waiting_for_trigger → routing → building → submitted → confirmed/failed`

1. Order created with status `pending`
2. System waits for price condition (`waiting_for_trigger`)
   - Polls DEX quotes every 1 second
   - Executes when `currentPrice >= limitPrice` (for selling)
   - Times out after 30 minutes (configurable)
3. Once condition met, proceeds like market order

**Use Case**: Execute only when price reaches target level

### Sniper Order

**Flow**: `pending → scanning_launch → routing → building → submitted → confirmed/failed`

1. Order created with status `pending`
2. System scans for token availability (`scanning_launch`)
   - Polls DEX quotes every 1 second
   - Executes immediately when ANY DEX returns valid quote
3. Once quote appears, proceeds like market order

**Use Case**: Sniping new token launches or migrations

## 🔌 HTTP → WebSocket Integration

The system uses a two-step process:

1. **POST /api/orders/execute**: Create order and get `orderId`
2. **GET /api/orders/:orderId/ws**: Connect WebSocket to receive real-time updates

**Example Flow**:

```javascript
// Step 1: Create order
const response = await fetch("http://localhost:3000/api/orders/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "market",
    tokenIn: "SOL",
    tokenOut: "USDC",
    amount: "100",
  }),
});

const { orderId } = await response.json();

// Step 2: Connect WebSocket
const ws = new WebSocket(`ws://localhost:3000/api/orders/${orderId}/ws`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Order status:", message.status);
};
```

## 🎯 DEX Routing

The system supports two mock DEXes:

### Raydium

- **Price Range**: `basePrice * (0.98 to 1.02)`
- **Fee**: 0.3% (0.003)
- **Delay**: 200ms

### Meteora

- **Price Range**: `basePrice * (0.97 to 1.02)`
- **Fee**: 0.2% (0.002)
- **Delay**: 200ms

### Best DEX Selection

The router compares **effective price** = `price * (1 + fee)` and selects the DEX with the lowest effective price.

**Example**:

- Raydium: price=1.0, fee=0.003 → effective=1.003
- Meteora: price=0.99, fee=0.002 → effective=0.99198
- **Selected**: Meteora (lower effective price)

## 🔄 Queue & Retry Logic

### Configuration

- **Queue Name**: `order-exec-queue`
- **Concurrency**: 10 orders simultaneously
- **Max Attempts**: 3 retries
- **Backoff**: Exponential (starts at 2 seconds)

### Retry Behavior

1. **First Failure**: Retry after 2 seconds
2. **Second Failure**: Retry after 4 seconds
3. **Third Failure**: Mark as `failed`, emit WebSocket event, save error message

### Queue Workers

Single worker with branching logic based on `order.type`:

- `market` → `MarketOrderService`
- `limit` → `LimitOrderService`
- `sniper` → `SniperOrderService`

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Local Setup

1. **Clone and install dependencies**:

```bash
npm install
```

2. **Set up environment variables**:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up database**:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

4. **Start Redis**:

```bash
redis-server
```

5. **Start the application**:

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

### Test Categories

1. **DEX Routing Tests** (`src/tests/dexRouter.test.ts`):

   - Raydium quote generation
   - Meteora quote generation
   - Best DEX selection
   - Swap execution

2. **Order Flow Tests** (`src/tests/orderFlow.test.ts`):

   - Market order lifecycle
   - Limit order price condition waiting
   - Sniper order token availability

3. **Queue Tests** (`src/tests/queue.test.ts`):

   - Job addition
   - Configuration validation

4. **WebSocket Tests** (`src/tests/websocket.test.ts`):

   - Connection management
   - Message emission
   - Event sequence validation

5. **Database Tests** (`src/tests/database.test.ts`):

   - Order creation
   - Status updates
   - Error message storage

6. **Integration Tests** (`src/tests/integration.test.ts`):
   - End-to-end order execution
   - Validation logic

## 🚢 Deployment

### Railway

1. **Create new project** on Railway
2. **Add PostgreSQL** service
3. **Add Redis** service
4. **Deploy from GitHub** or connect repository
5. **Set environment variables**:
   - `DATABASE_URL` (from PostgreSQL service)
   - `REDIS_HOST` (from Redis service)
   - `REDIS_PORT` (from Redis service)
   - Other config variables

### Render

1. **Create new Web Service**
2. **Connect GitHub repository**
3. **Add PostgreSQL** database
4. **Add Redis** instance
5. **Set environment variables**
6. **Build command**: `npm install && npm run build`
7. **Start command**: `npm start`

### Environment Variables

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=...
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=...
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
# or use Upstash REST credentials (auto-converts to Redis connection)
UPSTASH_REDIS_REST_URL=https://<your-upstash-instance>.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token
LIMIT_ORDER_TIMEOUT_MINUTES=30
SNIPER_POLL_INTERVAL_MS=1000
SNIPER_LAUNCH_DELAY_MS=60000
DEX_QUOTE_POLL_INTERVAL_MS=1000
QUEUE_CONCURRENCY=10
QUEUE_MAX_ATTEMPTS=3
```

## 📡 API Documentation

### POST /api/orders/execute

Create a new order.

**Request Body**:

```json
{
  "type": "market" | "limit" | "sniper",
  "tokenIn": "string",
  "tokenOut": "string",
  "amount": "string",
  "limitPrice": "string" // Required for limit orders
}
```

**Response**:

```json
{
  "orderId": "uuid"
}
```

**Example**:

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": "100"
  }'
```

### GET /api/orders/:orderId/ws

WebSocket endpoint for real-time order updates.

**Connection**: `ws://localhost:3000/api/orders/:orderId/ws`

### GET /health

Health check endpoint.

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📨 WebSocket Events

### Message Format

```json
{
  "orderId": "uuid",
  "status": "pending" | "routing" | "building" | "submitted" | "confirmed" | "failed" | "waiting_for_trigger" | "scanning_launch",
  "timestamp": "ISO 8601 string",
  "type": "market" | "limit" | "sniper",
  "details": {
    "dex": "raydium" | "meteora",
    "price": 1.05,
    "txHash": "0x...",
    "error": "string",
    ...
  }
}
```

### Event Sequence Examples

#### Market Order

```json
{"orderId": "...", "status": "pending", "type": "market"}
{"orderId": "...", "status": "routing", "type": "market", "details": {"dex": "raydium"}}
{"orderId": "...", "status": "building", "type": "market"}
{"orderId": "...", "status": "submitted", "type": "market", "details": {"txHash": "0x..."}}
{"orderId": "...", "status": "confirmed", "type": "market", "details": {"txHash": "0x...", "executedPrice": 1.05}}
```

#### Limit Order

```json
{"orderId": "...", "status": "pending", "type": "limit"}
{"orderId": "...", "status": "waiting_for_trigger", "type": "limit", "details": {"limitPrice": 1.0}}
{"orderId": "...", "status": "routing", "type": "limit", "details": {"dex": "meteora"}}
{"orderId": "...", "status": "building", "type": "limit"}
{"orderId": "...", "status": "submitted", "type": "limit", "details": {"txHash": "0x..."}}
{"orderId": "...", "status": "confirmed", "type": "limit", "details": {"txHash": "0x...", "executedPrice": 1.02}}
```

#### Sniper Order

```json
{"orderId": "...", "status": "pending", "type": "sniper"}
{"orderId": "...", "status": "scanning_launch", "type": "sniper", "details": {"message": "Scanning for token availability..."}}
{"orderId": "...", "status": "routing", "type": "sniper", "details": {"dex": "raydium"}}
{"orderId": "...", "status": "building", "type": "sniper"}
{"orderId": "...", "status": "submitted", "type": "sniper", "details": {"txHash": "0x..."}}
{"orderId": "...", "status": "confirmed", "type": "sniper", "details": {"txHash": "0x...", "executedPrice": 0.99}}
```

## 📁 Project Structure

```
src/
├── index.ts                 # Application entry point
├── config/
│   └── index.ts            # Configuration management
├── routes/
│   └── order.routes.ts     # HTTP routes
├── controllers/
│   └── order.controller.ts # Request handlers
├── services/
│   ├── order.service.ts    # Order CRUD operations
│   ├── marketOrder.service.ts
│   ├── limitOrder.service.ts
│   └── sniperOrder.service.ts
├── dex/
│   └── mockDexRouter.ts    # DEX routing logic
├── ws/
│   └── websocketHandler.ts # WebSocket management
├── queue/
│   ├── queue.ts           # Queue setup
│   └── orderProcessor.ts  # Job processors
├── db/
│   └── prisma.ts          # Prisma client
├── utils/
│   ├── types.ts           # TypeScript types
│   └── websocket.ts       # WebSocket utilities
└── tests/                 # Test files
```

## 🔧 Configuration

All configuration is managed via environment variables (see `.env.example`):

- **Server**: Port, environment
- **Database**: PostgreSQL connection string
- **Redis**: Host, port, password
- **Orders**: Timeout, poll intervals
- **Queue**: Concurrency, max attempts

## 📝 License

ISC

## 🤝 Contributing

This is a task implementation for Eterna Labs. For questions or issues, please refer to the task specification.

---

**Built with**: TypeScript, Fastify, Prisma, BullMQ, PostgreSQL, Redis, WebSocket
