import { getCandleEndTime, getCandleStartTime } from "./candles.js";
import type { FootprintCandle, FootprintLevel, TimeFrame } from "./types.js";

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

export function aggregateFootprintCandles(
  candles: readonly FootprintCandle[],
  targetTimeFrame: TimeFrame
): FootprintCandle {
  if (candles.length === 0) {
    throw new Error("Cannot aggregate an empty candle list");
  }
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    throw new Error("Cannot aggregate an empty candle list");
  }

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    if (!previous || !current) continue;
    if (current.startTime <= previous.startTime) {
      throw new Error("Candles must be provided in chronological order");
    }
  }

  const startTime = getCandleStartTime(first.startTime, targetTimeFrame);
  const endTime = getCandleEndTime(first.startTime, targetTimeFrame);
  const levels = new Map<number, FootprintLevel>();

  for (const candle of candles) {
    if (candle.marketId !== first.marketId) {
      throw new Error(
        `Candle market ${candle.marketId} does not match first candle market ${first.marketId}`
      );
    }
    if (candle.startTime < startTime || candle.endTime > endTime) {
      throw new Error(
        `Candle time range [${candle.startTime}, ${candle.endTime}) is outside the target time range ` +
        `[${startTime}, ${endTime})`
      );
    }
    for (const level of candle.levels.values()) {
      const existing = levels.get(level.price);
      levels.set(level.price, existing
        ? {
            price: level.price,
            bidVolume: existing.bidVolume + level.bidVolume,
            askVolume: existing.askVolume + level.askVolume,
            tradeCount: existing.tradeCount + level.tradeCount
          }
        : level);
    }
  }

  return {
    marketId: first.marketId,
    timeFrame: targetTimeFrame,
    startTime,
    endTime,
    open: first.open,
    high: Math.max(...candles.map((candle) => candle.high)),
    low: Math.min(...candles.map((candle) => candle.low)),
    close: last.close,
    volume: candles.reduce((sum, candle) => sum + candle.volume, 0),
    quoteVolume: candles.reduce((sum, candle) => sum + candle.quoteVolume, 0),
    tradeCount: candles.reduce((sum, candle) => sum + candle.tradeCount, 0),
    levels
  };
}

export function aggregateByTimeFrame(
  candles: readonly FootprintCandle[],
  targetTimeFrame: TimeFrame
): readonly FootprintCandle[] {
  if (candles.length === 0) return [];
  const first = candles[0];
  if (!first) return [];
  const sourceDuration = TIME_FRAME_DURATION_MS[first.timeFrame];
  const targetDuration = TIME_FRAME_DURATION_MS[targetTimeFrame];
  if (targetDuration < sourceDuration) {
    throw new Error(
      `Target timeframe ${targetTimeFrame} is smaller than source timeframe ${first.timeFrame}`
    );
  }
  if (targetDuration % sourceDuration !== 0) {
    throw new Error(
      `Target timeframe ${targetTimeFrame} is not a multiple of source timeframe ${first.timeFrame}`
    );
  }

  const groups = new Map<number, FootprintCandle[]>();
  for (const candle of candles) {
    if (candle.marketId !== first.marketId) {
      throw new Error(
        `Candle market ${candle.marketId} does not match source market ${first.marketId}`
      );
    }
    if (candle.timeFrame !== first.timeFrame) {
      throw new Error(
        `Candle timeframe ${candle.timeFrame} does not match source timeframe ${first.timeFrame}`
      );
    }
    const start = getCandleStartTime(candle.startTime, targetTimeFrame);
    const group = groups.get(start);
    if (group) group.push(candle);
    else groups.set(start, [candle]);
  }
  return [...groups.values()].map((group) =>
    aggregateFootprintCandles(group, targetTimeFrame)
  );
}
