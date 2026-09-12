import {
  deserializeFootprintCandle,
  getCandleDelta
} from "@orderflow/domain";

import type {
  SerializedFootprintCandle
} from "@orderflow/domain";

import type {
  HistogramData,
  Time,
  UTCTimestamp
} from "lightweight-charts";

export function toDeltaHistogramSeriesData(
  candles:
    readonly SerializedFootprintCandle[]
): HistogramData<Time>[] {
  return candles.map((candle) => {
    const footprintCandle =
      deserializeFootprintCandle(candle);

    const delta =
      getCandleDelta(footprintCandle);

    return {
      time: Math.floor(
        candle.startTime / 1_000
      ) as UTCTimestamp,

      value: delta,

      color:
        delta >= 0
          ? "rgba(34, 197, 94, 0.55)"
          : "rgba(239, 68, 68, 0.55)"
    };
  });
}