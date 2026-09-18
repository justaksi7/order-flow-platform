import {
  getCandleStartTime,
  getCandleVwap
} from "@orderflow/domain";

import type {
  Candle,
  TimeFrame
} from "@orderflow/domain";

import type {
  LineData,
  UTCTimestamp
} from "lightweight-charts";

export type SessionVwapData = {
  readonly sessionStart: number;
  readonly availableFrom: number;
  readonly startsLate: boolean;
  readonly points:
    readonly LineData<UTCTimestamp>[];
};

export function toSessionVwapData(
  candles: readonly Candle[],
  currentCandle: Candle | null,
  timeFrame: TimeFrame
): readonly SessionVwapData[] {
  const byTime = new Map(
    candles.map((candle) => [
      candle.startTime,
      candle
    ])
  );

  if (currentCandle) {
    byTime.set(
      currentCandle.startTime,
      currentCandle
    );
  }

  const source = [...byTime.values()].sort(
    (a, b) => a.startTime - b.startTime
  );

  const first = source[0];

  if (!first) {
    return [];
  }

  let volume = 0;
  let quoteVolume = 0;

  const points:
    LineData<UTCTimestamp>[] = [];

  for (const candle of source) {
    if (
      candle.timeFrame !== "1m" ||
      candle.marketId !== first.marketId
    ) {
      throw new Error(
        "VWAP requires 1m candles from one market"
      );
    }

    if (
      !Number.isFinite(candle.volume) ||
      candle.volume < 0 ||
      !Number.isFinite(candle.quoteVolume) ||
      candle.quoteVolume < 0
    ) {
      throw new Error(
        "Invalid candle volume for VWAP"
      );
    }

    volume += candle.volume;
    quoteVolume += candle.quoteVolume;

    if (volume === 0) {
      continue;
    }

    const point: LineData<UTCTimestamp> = {
      time: (
        getCandleStartTime(
          candle.startTime,
          timeFrame
        ) / 1_000
      ) as UTCTimestamp,

      value: getCandleVwap({
        ...candle,
        volume,
        quoteVolume
      })
    };

    const previous =
      points[points.length - 1];

    if (previous?.time === point.time) {
      points[points.length - 1] = point;
    } else {
      points.push(point);
    }
  }

  return [{
    sessionStart: first.startTime,
    availableFrom: first.startTime,
    startsLate: false,
    points
  }];
}