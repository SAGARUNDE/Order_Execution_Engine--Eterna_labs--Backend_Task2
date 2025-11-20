import { config } from "../config";

export type DexName = "raydium" | "meteora";

export interface DexQuote {
  dex: DexName;
  price: number;
  fee: number;
  delay: number;
}

export interface SwapResult {
  txHash: string;
  executedPrice: number;
}

export class MockDexRouter {
  private basePrice: number;

  constructor(basePrice: number = 1.0) {
    this.basePrice = basePrice;
  }

  /**
   * Get quote from Raydium
   * Price: basePrice * (0.98 + Math.random() * 0.04)
   * Fee: 0.003
   * Delay: 200ms
   */
  async getRaydiumQuote(amount: number): Promise<DexQuote> {
    await this.delay(200);

    const price = this.basePrice * (0.98 + Math.random() * 0.04);

    return {
      dex: "raydium",
      price,
      fee: 0.003,
      delay: 200,
    };
  }

  /**
   * Get quote from Meteora
   * Price: basePrice * (0.97 + Math.random() * 0.05)
   * Fee: 0.002
   * Delay: 200ms
   */
  async getMeteoraQuote(amount: number): Promise<DexQuote> {
    await this.delay(200);

    const price = this.basePrice * (0.97 + Math.random() * 0.05);

    return {
      dex: "meteora",
      price,
      fee: 0.002,
      delay: 200,
    };
  }

  /**
   * Get quotes from all DEXes
   */
  async getAllQuotes(amount: number): Promise<DexQuote[]> {
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(amount),
      this.getMeteoraQuote(amount),
    ]);

    return [raydiumQuote, meteoraQuote];
  }

  /**
   * Select best DEX based on effective price (price * (1 + fee))
   */
  selectBestDex(quotes: DexQuote[]): DexQuote {
    if (quotes.length === 0) {
      throw new Error("No quotes available");
    }

    const bestQuote = quotes.reduce((best, current) => {
      const bestEffectivePrice = best.price * (1 + best.fee);
      const currentEffectivePrice = current.price * (1 + current.fee);

      return currentEffectivePrice < bestEffectivePrice ? current : best;
    });

    // eslint-disable-next-line no-console
    (globalThis as any).console.log(
      `[DEX Router] Selected ${
        bestQuote.dex
      } with price ${bestQuote.price.toFixed(6)} and fee ${bestQuote.fee}`
    );

    return bestQuote;
  }

  /**
   * Execute swap on selected DEX
   * Simulates 2000-3000ms delay
   * @param quotePrice - Optional quote price to use as executed price (for limit orders)
   */
  async executeSwap(
    dex: DexName,
    order: { tokenIn: string; tokenOut: string; amount: string },
    quotePrice?: number
  ): Promise<SwapResult> {
    const delayMs = 2000 + Math.random() * 1000; // 2000-3000ms
    await this.delay(delayMs);

    // Generate mock transaction hash
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;

    // Use quote price if provided (for limit orders to ensure executed price matches quote)
    // Otherwise, use base price with random variation (for market orders)
    const executedPrice = quotePrice !== undefined 
      ? quotePrice 
      : this.basePrice * (0.97 + Math.random() * 0.05);

    return {
      txHash,
      executedPrice,
    };
  }

  /**
   * Check if token is available (for sniper orders)
   * Returns true if any DEX returns a valid quote
   */
  async checkTokenAvailability(
    tokenIn: string,
    tokenOut: string
  ): Promise<boolean> {
    try {
      const quotes = await this.getAllQuotes(1);
      return quotes.length > 0;
    } catch (error) {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      (globalThis as any).setTimeout(resolve, ms);
    });
  }
}
