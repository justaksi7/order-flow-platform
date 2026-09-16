import type {
  FootprintCandle
} from "./types.js";

type BufferOptions = {
  readonly retentionMs: number;
  readonly now?: () => number;
};

type HistoryQuery = {
  readonly before?: number;
  readonly limit?: number;
};

type HistoryPage = {
  readonly candles: readonly FootprintCandle[];
  readonly hasMore: boolean;
  readonly nextBefore: number | null;
};

export class FootprintCandleBuffer {
  private readonly candles: FootprintCandle[] = [];

  private readonly retentionMs: number;
  private readonly now: () => number;

  constructor(options: BufferOptions) {
    if (
      !Number.isFinite(options.retentionMs) ||
      options.retentionMs <= 0
    ) {
      throw new Error(
        `Invalid retention: ${options.retentionMs}`
      );
    }

    this.retentionMs = options.retentionMs;
    this.now = options.now ?? Date.now;
  }

  public add(candle: FootprintCandle): void {
    const now = this.now();

    if (
      !Number.isFinite(candle.startTime) ||
      !Number.isFinite(candle.endTime) ||
      candle.endTime <= candle.startTime
    ) {
      throw new Error("Invalid candle time range");
    }

    this.prune(now);

    if (candle.endTime <= now - this.retentionMs) {
      return;
    }

    const first = this.candles[0];

    if (
      first &&
      (
        candle.marketId !== first.marketId ||
        candle.timeFrame !== first.timeFrame ||
        candle.priceStep !== first.priceStep
      )
    ) {
      throw new Error(
        "Buffer requires the same market, timeframe and priceStep"
      );
    }

    // Sortierte Position suchen, auch für späteres
    // Wiederherstellen oder Korrigieren einer Candle.
    const index = this.findIndex(candle.startTime);
    const existing = this.candles[index];

    if (existing?.startTime === candle.startTime) {
      this.candles[index] = candle;
      return;
    }

    this.candles.splice(index, 0, candle);
  }

  public getAll(): readonly FootprintCandle[] {
    this.prune();
    return [...this.candles];
  }

  public getLatest(): FootprintCandle | undefined {
    this.prune();
    return this.candles[this.candles.length - 1];
  }

  public get size(): number {
    this.prune();
    return this.candles.length;
  }

  public getPage(
    query: HistoryQuery = {}
  ): HistoryPage {
    const limit = query.limit ?? 200;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500
    ) {
      throw new Error(
        "History limit must be between 1 and 500"
      );
    }

    if (
      query.before !== undefined &&
      !Number.isFinite(query.before)
    ) {
      throw new Error("Invalid history cursor");
    }

    this.prune();

    // "before" ist exklusiv: Die Candle an dieser
    // Startzeit wird nicht nochmals zurückgegeben.
    const endIndex =
      query.before === undefined
        ? this.candles.length
        : this.findIndex(query.before);

    const startIndex = Math.max(
      0,
      endIndex - limit
    );

    const candles = this.candles.slice(
      startIndex,
      endIndex
    );

    const hasMore = startIndex > 0;

    return {
      candles,
      hasMore,
      nextBefore:
        hasMore
          ? candles[0]?.startTime ?? null
          : null
    };
  }

  public prune(now: number = this.now()): void {
    const cutoff = now - this.retentionMs;

    let expiredCount = 0;

    for (const candle of this.candles) {
      if (candle.endTime > cutoff) {
        break;
      }

      expiredCount += 1;
    }

    if (expiredCount > 0) {
      this.candles.splice(0, expiredCount);
    }
  }

  public clear(): void {
    this.candles.length = 0;
  }

  private findIndex(startTime: number): number {
    let left = 0;
    let right = this.candles.length;

    while (left < right) {
      const middle = Math.floor(
        (left + right) / 2
      );

      const candle = this.candles[middle];

      if (candle && candle.startTime < startTime) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return left;
  }
}