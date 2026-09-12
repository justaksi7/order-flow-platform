import type {
  SerializedFootprintCandle
} from "@orderflow/domain";

import type {
  HistogramData,
  Time,
  UTCTimestamp
} from "lightweight-charts";

export function toVolumeSeriesData(
  candles:
    readonly SerializedFootprintCandle[]
): HistogramData<Time>[] {
  return candles.map((candle) => ({
    time: Math.floor(
      candle.startTime / 1_000
    ) as UTCTimestamp,

    value: candle.volume,

    color:
      candle.close >= candle.open
        ? "rgba(34, 197, 94, 0.65)"
        : "rgba(239, 68, 68, 0.65)"
  }));
}