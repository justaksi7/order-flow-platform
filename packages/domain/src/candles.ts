import type {
  Candle,
  FootprintCandle,
  FootprintLevel,
  TimeFrame,
  Trade
} from "./types.js";

const TIME_FRAME_DURATION_MS: Record<TimeFrame, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "8h": 8 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
};

export function getCandleStartTime(timestamp: number, timeFrame: TimeFrame): number {
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return Math.floor(timestamp / TIME_FRAME_DURATION_MS[timeFrame]) * TIME_FRAME_DURATION_MS[timeFrame];
}

export function getCandleEndTime(timestamp: number, timeFrame: TimeFrame): number {
  return getCandleStartTime(timestamp, timeFrame) + TIME_FRAME_DURATION_MS[timeFrame];
}

export function createCandle(trade: Trade, timeFrame: TimeFrame): Candle {
  const startTime = getCandleStartTime(trade.timestamp, timeFrame);

  return {
    marketId: trade.marketId,
    timeFrame,
    startTime,
    endTime: startTime + TIME_FRAME_DURATION_MS[timeFrame],
    open: trade.price,
    high: trade.price,
    low: trade.price,
    close: trade.price,
    volume: trade.quantity,
    quoteVolume: trade.price * trade.quantity,
    tradeCount: 1
  };
}

export function updateCandle(candle: Candle, trade: Trade): Candle {
  if (trade.marketId !== candle.marketId) {
    throw new Error(
      `Trade market ${trade.marketId} does not match candle market ${candle.marketId}`
    );
  }
  if (trade.timestamp < candle.startTime || trade.timestamp >= candle.endTime) {
    throw new Error(
      `Trade timestamp ${trade.timestamp} is outside the candle time range ` +
      `[${candle.startTime}, ${candle.endTime})`
    );
  }

  return {
    ...candle,
    high: Math.max(candle.high, trade.price),
    low: Math.min(candle.low, trade.price),
    close: trade.price,
    volume: candle.volume + trade.quantity,
    quoteVolume: candle.quoteVolume + trade.price * trade.quantity,
    tradeCount: candle.tradeCount + 1
  };
}

export interface CandleBuilderResult {
  readonly currentCandle: Candle;
  readonly completedCandle?: Candle;
}

export class CandleBuilder {
  private currentCandle: Candle | undefined;

  constructor(
    private readonly marketId: string,
    private readonly timeFrame: TimeFrame
  ) {}

  public addTrade(trade: Trade): CandleBuilderResult {
    if (trade.marketId !== this.marketId) {
      throw new Error(
        `Trade market ${trade.marketId} does not match builder market ${this.marketId}`
      );
    }
    if (!this.currentCandle) {
      this.currentCandle = createCandle(trade, this.timeFrame);
      return { currentCandle: this.currentCandle };
    }
    if (trade.timestamp < this.currentCandle.startTime) {
      throw new Error(
        `Out-of-order trade: timestamp ${trade.timestamp} is before ` +
        `current candle start ${this.currentCandle.startTime}`
      );
    }
    if (trade.timestamp >= this.currentCandle.endTime) {
      const completedCandle = this.currentCandle;
      this.currentCandle = createCandle(trade, this.timeFrame);
      return { currentCandle: this.currentCandle, completedCandle };
    }

    this.currentCandle = updateCandle(this.currentCandle, trade);
    return { currentCandle: this.currentCandle };
  }
}

export function getPriceLevel(
  price: number,
  priceStep: number
): number {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(priceStep) ||
    priceStep <= 0 ||
    price <= 0
  ) {
    throw new Error(
      `Invalid price ${price} or priceStep ${priceStep}`
    );
  }

  return Number(
    (
      Math.round(price / priceStep) *
      priceStep
    ).toFixed(8)
  );
}

export function createFootprintLevel(
  trade: Trade,
  priceStep: number
): FootprintLevel {
  const price = getPriceLevel(
    trade.price,
    priceStep
  );

  return {
    price,
    bidVolume:
      trade.side === "SELL"
        ? trade.quantity
        : 0,
    askVolume:
      trade.side === "BUY"
        ? trade.quantity
        : 0,
    tradeCount: 1
  };
}

export function updateFootprintLevel(
  level: FootprintLevel,
  trade: Trade,
  priceStep: number
): FootprintLevel {
  const price = getPriceLevel(
    trade.price,
    priceStep
  );

  if (price !== level.price) {
    throw new Error(
      `Trade price level ${price} does not match ` +
      `level price ${level.price}`
    );
  }

  return {
    ...level,

    bidVolume:
      level.bidVolume +
      (trade.side === "SELL"
        ? trade.quantity
        : 0),

    askVolume:
      level.askVolume +
      (trade.side === "BUY"
        ? trade.quantity
        : 0),

    tradeCount:
      level.tradeCount + 1
  };
}

export function createFootprintCandle(
  trade: Trade,
  timeFrame: TimeFrame,
  priceStep: number
): FootprintCandle {
  const level = createFootprintLevel(
    trade,
    priceStep
  );

  return {
    ...createCandle(trade, timeFrame),
    priceStep,

    levels: new Map([
      [level.price, level]
    ])
  };
}

export function updateFootprintCandle(
  candle: FootprintCandle,
  trade: Trade
): FootprintCandle {
  const price = getPriceLevel(
    trade.price,
    candle.priceStep
  );

  const existingLevel =
    candle.levels.get(price);

  const updatedLevel = existingLevel
    ? updateFootprintLevel(
        existingLevel,
        trade,
        candle.priceStep
      )
    : createFootprintLevel(
        trade,
        candle.priceStep
      );

  const levels = new Map(candle.levels);

  levels.set(price, updatedLevel);

  return {
  ...updateCandle(candle, trade),
  priceStep: candle.priceStep,
  levels
};
}

export interface FootprintCandleBuilderResult {
  readonly currentCandle: FootprintCandle;
  readonly completedCandle?: FootprintCandle;
}

export class FootprintCandleBuilder {
  private currentCandle:
    FootprintCandle | undefined;

  constructor(
    private readonly marketId: string,
    private readonly timeFrame: TimeFrame,
    private readonly priceStep: number
  ) {
    if (
      !Number.isFinite(priceStep) ||
      priceStep <= 0
    ) {
      throw new Error(
        `Invalid priceStep: ${priceStep}`
      );
    }
  }

  public addTrade(
    trade: Trade
  ): FootprintCandleBuilderResult {
    if (trade.marketId !== this.marketId) {
      throw new Error(
        `Trade market ${trade.marketId} does not match ` +
        `builder market ${this.marketId}`
      );
    }

    if (!this.currentCandle) {
      this.currentCandle =
        createFootprintCandle(
          trade,
          this.timeFrame,
          this.priceStep
        );

      return {
        currentCandle: this.currentCandle
      };
    }

    if (
      trade.timestamp <
      this.currentCandle.startTime
    ) {
      throw new Error(
        `Out-of-order trade: timestamp ${trade.timestamp} ` +
        `is before current candle start ` +
        `${this.currentCandle.startTime}`
      );
    }

    if (
      trade.timestamp >=
      this.currentCandle.endTime
    ) {
      const completedCandle =
        this.currentCandle;

      this.currentCandle =
        createFootprintCandle(
          trade,
          this.timeFrame,
          this.priceStep
        );

      return {
        currentCandle: this.currentCandle,
        completedCandle
      };
    }

    this.currentCandle =
      updateFootprintCandle(
        this.currentCandle,
        trade
      );

    return {
      currentCandle: this.currentCandle
    };
  }
}

export function getCandleVwap(candle: Candle): number {
  if (!Number.isFinite(candle.volume) || candle.volume <= 0) {
    throw new Error(`Cannot calculate VWAP with volume ${candle.volume}`);
  }
  if (!Number.isFinite(candle.quoteVolume)) {
    throw new Error(`Invalid quoteVolume ${candle.quoteVolume}`);
  }
  return candle.quoteVolume / candle.volume;
}

export function getCandleDelta(candle: FootprintCandle): number {
  let delta = 0;
  for (const level of candle.levels.values()) {
    delta += level.askVolume - level.bidVolume;
  }
  return delta;
}
