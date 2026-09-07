import type {
  FootprintCandle,
  FootprintLevel,
  SerializedFootprintCandle
} from "./types.js";

export function serializeFootprintCandle(
  candle: FootprintCandle
): SerializedFootprintCandle {
  return {
    ...candle,
    levels: [...candle.levels.values()].sort((a, b) => a.price - b.price)
  };
}

export function deserializeFootprintCandle(
  candle: SerializedFootprintCandle
): FootprintCandle {
  const levels = new Map<number, FootprintLevel>();
  for (const level of candle.levels) {
    if (levels.has(level.price)) {
      throw new Error(`Duplicate footprint level price: ${level.price}`);
    }
    levels.set(level.price, level);
  }
  return { ...candle, levels };
}
