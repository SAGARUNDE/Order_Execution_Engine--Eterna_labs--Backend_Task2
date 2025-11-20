# Postman Testing Guide

Complete guide for testing the Order Execution Engine API using Postman.

## 📋 Prerequisites

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Ensure services are running**:
   - PostgreSQL (database)
   - Redis (queue backend)

3. **Import the collection**:
   - Open Postman
   - Click **Import** → Select `postman_collection.json`
   - Or drag and drop the file into Postman

## 🔧 Setup

1. **Set Collection Variable**:
   - Open the collection in Postman
   - Go to **Variables** tab
   - Ensure `base_url` is set to: `http://localhost:3000`

2. **Create Environment (Optional)**:
   - Create a new environment named "Local"
   - Add variable: `base_url` = `http://localhost:3000`
   - Add variable: `order_id` = (will be auto-filled from responses)

## 📡 API Endpoints

### 1. Health Check

**Request**: `GET /health`

**Steps**:
1. Select "Health Check" request
2. Click **Send**
3. Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-11-19T04:06:34.000Z"
   }
   ```

**✅ Use this to verify the server is running before testing other endpoints.**

---

### 2. Create Market Order

**Request**: `POST /api/orders/execute`

**Body**:
```json
{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": "100"
}
```

**Steps**:
1. Select "Create Market Order" request
2. Click **Send**
3. Copy the `orderId` from response:
   ```json
   {
     "orderId": "uuid-here"
   }
   ```
4. **Save the orderId** for WebSocket connection (see step 4)

**Expected Response**:
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ This creates an order that executes immediately.**

---

### 3. Create Limit Order

**Request**: `POST /api/orders/execute`

**Body**:
```json
{
  "type": "limit",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": "100",
  "limitPrice": "1.05"
}
```

**Steps**:
1. Select "Create Limit Order" request
2. Click **Send**
3. Copy the `orderId` from response
4. **Save the orderId** for WebSocket connection

**Expected Response**:
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ This creates an order that waits for price condition (currentPrice >= limitPrice).**

**Note**: The order will wait until the price condition is met (or timeout after 30 minutes).

---

### 4. Create Sniper Order

**Request**: `POST /api/orders/execute`

**Body**:
```json
{
  "type": "sniper",
  "tokenIn": "NEW_TOKEN",
  "tokenOut": "USDC",
  "amount": "100"
}
```

**Steps**:
1. Select "Create Sniper Order" request
2. Click **Send**
3. Copy the `orderId` from response
4. **Save the orderId** for WebSocket connection

**Expected Response**:
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ This creates an order that waits for token availability (launch detection).**

---

## 🔌 WebSocket Testing

**Note**: Postman v10+ supports WebSocket connections. If you have an older version, use a WebSocket client like:
- [WebSocket King](https://websocketking.com/)
- [wscat](https://github.com/websockets/wscat) (CLI tool)

### Using Postman WebSocket (v10+)

1. **Create New WebSocket Request**:
   - Click **New** → **WebSocket Request**
   - URL: `ws://localhost:3000/api/orders/{orderId}/ws`
   - Replace `{orderId}` with the order ID from step 2, 3, or 4

2. **Connect**:
   - Click **Connect**
   - You should receive an initial message:
     ```json
     {
       "orderId": "550e8400-e29b-41d4-a716-446655440000",
       "status": "pending",
       "timestamp": "2024-11-19T04:06:34.000Z",
       "type": "market",
       "details": {
         "message": "Connected to order stream"
       }
     }
     ```

3. **Monitor Events**:
   - Watch for status updates in real-time
   - Events will appear in the messages panel

### Expected WebSocket Event Sequences

#### Market Order Events:
```json
// 1. pending
{"orderId": "...", "status": "pending", "type": "market"}

// 2. routing
{"orderId": "...", "status": "routing", "type": "market", "details": {"dex": "raydium"}}

// 3. building
{"orderId": "...", "status": "building", "type": "market"}

// 4. submitted
{"orderId": "...", "status": "submitted", "type": "market", "details": {"txHash": "0x..."}}

// 5. confirmed
{"orderId": "...", "status": "confirmed", "type": "market", "details": {"txHash": "0x...", "executedPrice": 1.05}}
```

#### Limit Order Events:
```json
// 1. pending
{"orderId": "...", "status": "pending", "type": "limit"}

// 2. waiting_for_trigger
{"orderId": "...", "status": "waiting_for_trigger", "type": "limit", "details": {"limitPrice": 1.05}}

// 3. routing (when condition met)
{"orderId": "...", "status": "routing", "type": "limit", "details": {"dex": "meteora"}}

// 4. building
{"orderId": "...", "status": "building", "type": "limit"}

// 5. submitted
{"orderId": "...", "status": "submitted", "type": "limit", "details": {"txHash": "0x..."}}

// 6. confirmed
{"orderId": "...", "status": "confirmed", "type": "limit", "details": {"txHash": "0x...", "executedPrice": 1.02}}
```

#### Sniper Order Events:
```json
// 1. pending
{"orderId": "...", "status": "pending", "type": "sniper"}

// 2. scanning_launch
{"orderId": "...", "status": "scanning_launch", "type": "sniper", "details": {"message": "Scanning for token availability..."}}

// 3. routing (when token available)
{"orderId": "...", "status": "routing", "type": "sniper", "details": {"dex": "raydium"}}

// 4. building
{"orderId": "...", "status": "building", "type": "sniper"}

// 5. submitted
{"orderId": "...", "status": "submitted", "type": "sniper", "details": {"txHash": "0x..."}}

// 6. confirmed
{"orderId": "...", "status": "confirmed", "type": "sniper", "details": {"txHash": "0x...", "executedPrice": 0.99}}
```

### Using wscat (CLI Alternative)

If you don't have Postman v10+, use wscat:

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket (replace ORDER_ID with actual order ID)
wscat -c ws://localhost:3000/api/orders/ORDER_ID/ws
```

---

## 🧪 Complete Testing Workflow

### Test Market Order (Quick Test)

1. **Health Check**: Verify server is running
2. **Create Market Order**: POST `/api/orders/execute` with market order body
3. **Copy orderId** from response
4. **Connect WebSocket**: `ws://localhost:3000/api/orders/{orderId}/ws`
5. **Observe events**: Should see `pending → routing → building → submitted → confirmed`

### Test Limit Order (Wait for Condition)

1. **Create Limit Order**: POST `/api/orders/execute` with limit order body (limitPrice: "1.05")
2. **Copy orderId**
3. **Connect WebSocket**
4. **Observe events**: Should see `pending → waiting_for_trigger → routing → ... → confirmed`
5. **Note**: Order waits until price condition is met (may take a few seconds)

### Test Sniper Order (Token Availability)

1. **Create Sniper Order**: POST `/api/orders/execute` with sniper order body
2. **Copy orderId**
3. **Connect WebSocket**
4. **Observe events**: Should see `pending → scanning_launch → routing → ... → confirmed`
5. **Note**: Order waits until token becomes available

---

## 📝 Tips

1. **Save orderId**: After creating an order, copy the `orderId` immediately
2. **Multiple Orders**: You can create multiple orders and connect multiple WebSocket clients
3. **Watch Server Logs**: Keep terminal with `npm run dev` visible to see processing logs
4. **Test All Types**: Try all three order types to see different event sequences
5. **Error Testing**: Try invalid requests (missing fields, wrong types) to test validation

---

## 🎯 Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/orders/execute` | POST | Create order (market/limit/sniper) |
| `/api/orders/:orderId/ws` | WS | Real-time order updates |

**Order Types**:
- `market`: Immediate execution
- `limit`: Wait for price condition
- `sniper`: Wait for token availability


