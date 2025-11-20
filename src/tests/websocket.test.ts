import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketEmitter } from '../ws/websocketHandler';
import { Server as WebSocketServer } from 'ws';

describe('WebSocket Handler', () => {
  let wsEmitter: WebSocketEmitter;
  let mockWs: any;

  beforeEach(() => {
    wsEmitter = new WebSocketEmitter();
    mockWs = {
      readyState: WebSocketServer.OPEN,
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
    };
  });

  describe('Connection Management', () => {
    it('should register WebSocket connection', () => {
      wsEmitter.register('order-123', mockWs as any);
      expect(wsEmitter.getConnectionCount('order-123')).toBe(1);
    });

    it('should unregister WebSocket connection', () => {
      wsEmitter.register('order-123', mockWs as any);
      wsEmitter.unregister('order-123', mockWs as any);
      expect(wsEmitter.getConnectionCount('order-123')).toBe(0);
    });

    it('should handle multiple connections for same order', () => {
      const ws1 = { ...mockWs };
      const ws2 = { ...mockWs };
      wsEmitter.register('order-123', ws1 as any);
      wsEmitter.register('order-123', ws2 as any);
      expect(wsEmitter.getConnectionCount('order-123')).toBe(2);
    });
  });

  describe('Message Emission', () => {
    it('should emit messages to registered connections', () => {
      wsEmitter.register('order-123', mockWs as any);
      wsEmitter.emit('order-123', 'pending', { type: 'market' });

      expect(mockWs.send).toHaveBeenCalled();
      const callArgs = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(callArgs);
      expect(message.orderId).toBe('order-123');
      expect(message.status).toBe('pending');
      expect(message.type).toBe('market');
    });

    it('should include order type in messages', () => {
      wsEmitter.register('order-123', mockWs as any, 'limit');
      wsEmitter.emit('order-123', 'waiting_for_trigger');

      expect(mockWs.send).toHaveBeenCalled();
      const callArgs = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(callArgs);
      expect(message.type).toBe('limit');
    });

    it('should not emit to closed connections', () => {
      const closedWs = {
        ...mockWs,
        readyState: WebSocketServer.CLOSED,
      };
      wsEmitter.register('order-123', closedWs as any);
      wsEmitter.emit('order-123', 'pending');

      expect(closedWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Event Sequence', () => {
    it('should emit events in correct sequence for market order', () => {
      const events: string[] = [];
      wsEmitter.register('order-123', mockWs as any, 'market');
      
      mockWs.send = vi.fn((msg) => {
        const message = JSON.parse(msg);
        events.push(message.status);
      });

      wsEmitter.emit('order-123', 'pending', { type: 'market' });
      wsEmitter.emit('order-123', 'routing', { type: 'market' });
      wsEmitter.emit('order-123', 'building', { type: 'market' });
      wsEmitter.emit('order-123', 'submitted', { type: 'market' });
      wsEmitter.emit('order-123', 'confirmed', { type: 'market' });

      expect(events).toEqual(['pending', 'routing', 'building', 'submitted', 'confirmed']);
    });

    it('should include additional events for limit order', () => {
      const events: string[] = [];
      wsEmitter.register('order-123', mockWs as any, 'limit');
      
      mockWs.send = vi.fn((msg) => {
        const message = JSON.parse(msg);
        events.push(message.status);
      });

      wsEmitter.emit('order-123', 'pending', { type: 'limit' });
      wsEmitter.emit('order-123', 'waiting_for_trigger', { type: 'limit' });
      wsEmitter.emit('order-123', 'routing', { type: 'limit' });
      wsEmitter.emit('order-123', 'confirmed', { type: 'limit' });

      expect(events).toContain('waiting_for_trigger');
    });

    it('should include additional events for sniper order', () => {
      const events: string[] = [];
      wsEmitter.register('order-123', mockWs as any, 'sniper');
      
      mockWs.send = vi.fn((msg) => {
        const message = JSON.parse(msg);
        events.push(message.status);
      });

      wsEmitter.emit('order-123', 'pending', { type: 'sniper' });
      wsEmitter.emit('order-123', 'scanning_launch', { type: 'sniper' });
      wsEmitter.emit('order-123', 'routing', { type: 'sniper' });
      wsEmitter.emit('order-123', 'confirmed', { type: 'sniper' });

      expect(events).toContain('scanning_launch');
    });
  });

  describe('History Replay', () => {
    it('should store history even without active connections', () => {
      wsEmitter.emit('order-123', 'pending', { type: 'market' });
      expect(wsEmitter.hasHistory('order-123')).toBe(true);
    });

    it('should replay history to late subscribers', () => {
      wsEmitter.emit('order-123', 'pending', { type: 'market' });
      wsEmitter.emit('order-123', 'routing', { type: 'market' });

      wsEmitter.register('order-123', mockWs as any, 'market');
      const replayed = wsEmitter.replayHistory('order-123', mockWs as any);

      expect(replayed).toBe(2);
      expect(mockWs.send).toHaveBeenCalledTimes(2);

      const firstMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const secondMessage = JSON.parse(mockWs.send.mock.calls[1][0]);

      expect(firstMessage.status).toBe('pending');
      expect(secondMessage.status).toBe('routing');
    });
  });
});

