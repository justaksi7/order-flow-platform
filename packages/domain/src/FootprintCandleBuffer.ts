import type { FootprintCandle } from "@orderflow/domain";

export class FootprintCandleBuffer {
  private readonly candles: FootprintCandle[] = [];

  constructor(
    private readonly capacity: number
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`Invalid capacity: ${capacity}`);
    }
  }

  public add(candle: FootprintCandle): void {
    this.candles.push(candle);

    if (this.candles.length > this.capacity) {
      this.candles.shift();
    }
  }

  public getAll(): readonly FootprintCandle[] {
    return [...this.candles];
  }

  public getLatest(): FootprintCandle | undefined {
    return this.candles[this.candles.length - 1];
  }

  public get size(): number {
    return this.candles.length;
  }

  public clear(): void {
    this.candles.length = 0;
  }
}