import { getCandleEndTime, getCandleStartTime } from "./candles.js";
import type { FootprintCandle, FootprintLevel, TimeFrame } from "./types.js";

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
): FootprintCandle {
  return aggregateFootprintCandles(candles, targetTimeFrame);
}
