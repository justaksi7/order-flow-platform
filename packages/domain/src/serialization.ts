import type { FootprintCandle, FootprintLevel } from "./types.js";

interface SerializedFootprintCandle extends Omit<FootprintCandle, "levels"> {
  readonly levels: readonly FootprintLevel[];
}

export function serializeFootprintCandle(candle: FootprintCandle): string {
  const serializable: SerializedFootprintCandle = {
    ...candle,
    levels: [...candle.levels.values()]
  };
  return JSON.stringify(serializable);
}

export function deserializeFootprintCandle(serialized: string): FootprintCandle {
  const parsed = JSON.parse(serialized) as SerializedFootprintCandle;
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Serialized footprint candle must contain a levels array");
  }
  return { ...parsed, levels: new Map(parsed.levels.map((level) => [level.price, level])) };
}
