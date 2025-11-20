import { describe, it, expect, beforeEach } from 'vitest';
import { MockDexRouter } from '../dex/mockDexRouter';

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter(1.0);
  });

  describe('getRaydiumQuote', () => {
    it('should return a quote from Raydium with correct structure', async () => {
      const quote = await router.getRaydiumQuote(100);

      expect(quote).toHaveProperty('dex', 'raydium');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.003);
      expect(quote).toHaveProperty('delay', 200);
      expect(quote.price).toBeGreaterThan(0);
      // Price should be in range: basePrice * (0.98 to 1.02)
      expect(quote.price).toBeGreaterThanOrEqual(0.98);
      expect(quote.price).toBeLessThanOrEqual(1.02);
    });
  });

  describe('getMeteoraQuote', () => {
    it('should return a quote from Meteora with correct structure', async () => {
      const quote = await router.getMeteoraQuote(100);

      expect(quote).toHaveProperty('dex', 'meteora');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.002);
      expect(quote).toHaveProperty('delay', 200);
      expect(quote.price).toBeGreaterThan(0);
      // Price should be in range: basePrice * (0.97 to 1.02)
      expect(quote.price).toBeGreaterThanOrEqual(0.97);
      expect(quote.price).toBeLessThanOrEqual(1.02);
    });
  });

  describe('getAllQuotes', () => {
    it('should return quotes from both DEXes', async () => {
      const quotes = await router.getAllQuotes(100);

      expect(quotes).toHaveLength(2);
      expect(quotes.some(q => q.dex === 'raydium')).toBe(true);
      expect(quotes.some(q => q.dex === 'meteora')).toBe(true);
    });
  });

  describe('selectBestDex', () => {
    it('should select the DEX with the best effective price', () => {
      const quotes = [
        { dex: 'raydium' as const, price: 1.0, fee: 0.003, delay: 200 },
        { dex: 'meteora' as const, price: 0.99, fee: 0.002, delay: 200 },
      ];

      const best = router.selectBestDex(quotes);

      // Meteora: 0.99 * 1.002 = 0.99198
      // Raydium: 1.0 * 1.003 = 1.003
      // Meteora should be selected
      expect(best.dex).toBe('meteora');
    });

    it('should handle single quote', () => {
      const quotes = [
        { dex: 'raydium' as const, price: 1.0, fee: 0.003, delay: 200 },
      ];

      const best = router.selectBestDex(quotes);
      expect(best.dex).toBe('raydium');
    });

    it('should throw error when no quotes provided', () => {
      expect(() => router.selectBestDex([])).toThrow('No quotes available');
    });
  });

  describe('executeSwap', () => {
    it('should execute swap and return transaction hash and price', async () => {
      const result = await router.executeSwap('raydium', {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: '100',
      });

      expect(result).toHaveProperty('txHash');
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result).toHaveProperty('executedPrice');
      expect(result.executedPrice).toBeGreaterThan(0);
    });
  });

  describe('checkTokenAvailability', () => {
    it('should return true when token is available', async () => {
      const available = await router.checkTokenAvailability('SOL', 'USDC');
      expect(available).toBe(true);
    });
  });
});



