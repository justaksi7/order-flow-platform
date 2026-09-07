export type Exchange = "BITGET";

export type ProductType = "USDT_FUTURES";

export type TradeSide = "BUY" | "SELL";

export type TimeFrame = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "8h" | "12h" |"1d";

export interface MarketDisplay {
  readonly priceDecimals: number;
  readonly quantityDecimals: number;
}

export interface Market {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly exchange: Exchange;
  readonly productType: ProductType;
  readonly tickSize: number;
  readonly display: MarketDisplay;
}

export interface Trade {
  readonly id: string;
  readonly marketId: string;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly timestamp: number;
  readonly price: number;
  readonly quantity: number;
  readonly side: TradeSide;
}

export interface Candle {
  readonly marketId: string;
  readonly timeFrame: TimeFrame;
  readonly startTime: number;
  readonly endTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly quoteVolume: number;
  readonly tradeCount: number;
}

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

export function getCandleStartTime(
  timestamp: number,
  timeFrame: TimeFrame
): number {
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  const duration = TIME_FRAME_DURATION_MS[timeFrame];

  return Math.floor(timestamp / duration) * duration;
}

export function getCandleEndTime(
  timestamp: number,
  timeFrame: TimeFrame
): number {
  const startTime = getCandleStartTime(timestamp, timeFrame);
  const duration = TIME_FRAME_DURATION_MS[timeFrame];

  return startTime + duration;
}

export function createCandle(
  trade: Trade,
  timeFrame: TimeFrame
): Candle 
{
  const startTime = getCandleStartTime(trade.timestamp, timeFrame);
  const endTime = getCandleEndTime(trade.timestamp, timeFrame);

  return {
    marketId: trade.marketId,
    timeFrame,
    startTime,
    endTime,
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

  if (
    trade.timestamp < candle.startTime ||
    trade.timestamp >= candle.endTime
  ) {
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

      return {
        currentCandle: this.currentCandle
      };
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

      return {
        currentCandle: this.currentCandle,
        completedCandle
      };
    }

    this.currentCandle = updateCandle(this.currentCandle, trade);

    return {
      currentCandle: this.currentCandle
    };
  }
}

export interface FootprintLevel {
  readonly price: number;
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly tradeCount: number;
}

export interface FootprintCandle extends Candle {
  readonly levels: ReadonlyMap<number, FootprintLevel>;
}

export function getPriceLevel(
  price: number,
  tickSize: number,
):number{
  if(!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0 || price <= 0){
    throw new Error(`Invalid price ${price} or tickSize ${tickSize}`);
  }
  const level = Math.round(price / tickSize) * tickSize;
  return Number(level.toFixed(8));
}

export function createFootprintLevel(
  trade: Trade,
  tickSize: number
): FootprintLevel {
  const priceLevel = getPriceLevel(trade.price, tickSize);
  
  return {
    price: priceLevel,
    bidVolume: trade.side === "SELL" ? trade.quantity : 0,
    askVolume: trade.side === "BUY" ? trade.quantity : 0,
    tradeCount: 1
  };
}

export function updateFootprintLevel(
  level: FootprintLevel,
  trade: Trade,
  tickSize: number
): FootprintLevel {
  const priceLevel = getPriceLevel(trade.price, tickSize);

  if (priceLevel !== level.price) {
    throw new Error(
      `Trade price level ${priceLevel} does not match level price ${level.price}`
    );
  }

  return {
    ...level,
    bidVolume:
      level.bidVolume + (trade.side === "SELL" ? trade.quantity : 0),
    askVolume:
      level.askVolume + (trade.side === "BUY" ? trade.quantity : 0),
    tradeCount: level.tradeCount + 1
  };
}

export function createFootprintCandle(
  trade: Trade,
  timeFrame: TimeFrame,
  tickSize: number
): FootprintCandle {
  const candle = createCandle(trade, timeFrame);
  const level = createFootprintLevel(trade, tickSize);

  return {
    ...candle,
    levels: new Map([[level.price, level]])
  };
}

export function updateFootprintCandle(
  candle: FootprintCandle,
  trade: Trade,
  tickSize: number
): FootprintCandle {
  const updatedCandle = updateCandle(candle, trade);

  const priceLevel = getPriceLevel(trade.price, tickSize);
  const existingLevel = candle.levels.get(priceLevel);

  const updatedLevel = existingLevel
    ? updateFootprintLevel(existingLevel, trade, tickSize)
    : createFootprintLevel(trade, tickSize);

  const updatedLevels = new Map(candle.levels);
  updatedLevels.set(priceLevel, updatedLevel);

  return {
    ...updatedCandle,
    levels: updatedLevels
  };
}

export interface FootprintCandleBuilderResult {
  readonly currentCandle: FootprintCandle;
  readonly completedCandle?: FootprintCandle;
}

export class FootprintCandleBuilder {
  private currentCandle: FootprintCandle | undefined;

  constructor(
    private readonly marketId: string,
    private readonly timeFrame: TimeFrame,
    private readonly tickSize: number
  ) {
    if (!Number.isFinite(tickSize) || tickSize <= 0) {
      throw new Error(`Invalid tickSize: ${tickSize}`);
    }
  }
  
  public addTrade(trade: Trade): FootprintCandleBuilderResult {
    if (trade.marketId !== this.marketId) {
      throw new Error(
        `Trade market ${trade.marketId} does not match builder market ${this.marketId}`
      );
    }

    if (!this.currentCandle) {
      this.currentCandle = createFootprintCandle(trade, this.timeFrame, this.tickSize);

      return {
        currentCandle: this.currentCandle
      };
    }

    if (trade.timestamp < this.currentCandle.startTime) {
      throw new Error(
        `Out-of-order trade: timestamp ${trade.timestamp} is before ` +
        `current candle start ${this.currentCandle.startTime}`
      );
    }

    if (trade.timestamp >= this.currentCandle.endTime) {
      const completedCandle = this.currentCandle;
      this.currentCandle = createFootprintCandle(trade, this.timeFrame, this.tickSize);

      return {
        currentCandle: this.currentCandle,
        completedCandle
      };
    }

    this.currentCandle = updateFootprintCandle(this.currentCandle, trade, this.tickSize);

    return {
      currentCandle: this.currentCandle
    };
  }
}

export function getCandleVwap(candle: Candle): number {
  if (!Number.isFinite(candle.volume) || candle.volume <= 0) {
    throw new Error(
      `Cannot calculate VWAP with volume ${candle.volume}`
    );
  }

  if (!Number.isFinite(candle.quoteVolume)) {
    throw new Error(
      `Invalid quoteVolume ${candle.quoteVolume}`
    );
  }

  return candle.quoteVolume / candle.volume;
}

export function aggregateFootprintCandles(
  candles: readonly FootprintCandle[],
  targetTimeFrame: TimeFrame
): FootprintCandle {
  if (candles.length === 0) {
    throw new Error("Cannot aggregate an empty candle list");
  }

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

  if (!firstCandle || !lastCandle) {
    throw new Error("Cannot aggregate an empty candle list");
  }
  for (let index = 1; index < candles.length; index++) {
  const previousCandle = candles[index - 1];
  const currentCandle = candles[index];

  if (!previousCandle || !currentCandle) {
    continue;
  }

  if (currentCandle.startTime <= previousCandle.startTime) {
    throw new Error(
      "Candles must be provided in chronological order"
    );
  }
}
const targetStartTime = getCandleStartTime(
  firstCandle.startTime,
  targetTimeFrame
);

const targetEndTime = getCandleEndTime(
  firstCandle.startTime,
  targetTimeFrame
);
for (const candle of candles) {
  if (candle.marketId !== firstCandle.marketId) {
    throw new Error(
      `Candle market ${candle.marketId} does not match first candle market ${firstCandle.marketId}`
    );
  }

  if (
    candle.startTime < targetStartTime ||
    candle.endTime > targetEndTime
  ) {
    throw new Error(
      `Candle time range [${candle.startTime}, ${candle.endTime}) is outside the target time range ` +
      `[${targetStartTime}, ${targetEndTime})`
    );
}
}
const high = Math.max(...candles.map(c => c.high));
const low = Math.min(...candles.map(c => c.low));
const volume = candles.reduce((sum, c) => sum + c.volume, 0);
const quoteVolume = candles.reduce((sum, c) => sum + c.quoteVolume, 0);
const tradeCount = candles.reduce((sum, c) => sum + c.tradeCount, 0);

const levels = new Map<number, FootprintLevel>();

for (const candle of candles) {
  for (const level of candle.levels.values()) {
    const existingLevel = levels.get(level.price);

    if (existingLevel) {
      levels.set(level.price, {
        price: level.price,
        bidVolume:
          existingLevel.bidVolume + level.bidVolume,
        askVolume:
          existingLevel.askVolume + level.askVolume,
        tradeCount:
          existingLevel.tradeCount + level.tradeCount
      });
    } else {
      levels.set(level.price, level);
    }
  }
}
return {
  marketId: firstCandle.marketId,
  timeFrame: targetTimeFrame,
  startTime: targetStartTime,
  endTime: targetEndTime,
  open: firstCandle.open,
  high,
  low,
  close: lastCandle.close,
  volume,
  quoteVolume,
  tradeCount,
  levels
}
}