import {
  calculateCumulativeDelta,
  deserializeFootprintCandle
} from "@orderflow/domain";

import type {
  SerializedFootprintCandle
} from "@orderflow/domain";

import type {
  LineData,
  Time,
  UTCTimestamp
} from "lightweight-charts";

export function toCumulativeDeltaSeriesData(
  candles:
    readonly SerializedFootprintCandle[],
  initialValue = 0
): readonly LineData<Time>[] {
  const footprintCandles =
    candles.map(
      deserializeFootprintCandle
    );

  const cumulativeDeltaPoints =
    calculateCumulativeDelta(
      footprintCandles,
      initialValue
    );

  return cumulativeDeltaPoints.map(
    (point) => ({
      time: Math.floor(
        point.startTime / 1_000
      ) as UTCTimestamp,

      value: point.cumulativeDelta
    })
  );
}