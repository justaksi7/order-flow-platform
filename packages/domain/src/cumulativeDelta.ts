import { getCandleDelta } from "./candles.js";
import type { CumulativeDeltaPoint, FootprintCandle } from "./types.js";

export function calculateCumulativeDelta(
  candles: readonly FootprintCandle[],
  initialValue = 0
): readonly CumulativeDeltaPoint[] {
  let cumulativeDelta = initialValue;
  return candles.map((candle) => {
    const delta = getCandleDelta(candle);
    cumulativeDelta += delta;
    return {
      startTime: candle.startTime,
      endTime: candle.endTime,
      delta,
      cumulativeDelta
    };
  });
}

export const calculateCvd = calculateCumulativeDelta;
