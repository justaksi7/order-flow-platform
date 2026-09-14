import type {
  CustomData,
  Time,
  UTCTimestamp
} from "lightweight-charts";

import type {
  ServerMessage
} from "@orderflow/protocol";

import {
  createVolumeProfile,
  deserializeFootprintCandle
} from "@orderflow/domain";

type SnapshotMessage = Extract<
  ServerMessage,
  { type: "SNAPSHOT" }
>;

type SerializedCandle =
  SnapshotMessage["candles"][number];

export type FootprintLevelData =
  SerializedCandle["levels"][number];

export interface FootprintSeriesData
  extends CustomData<Time> {
  readonly time: UTCTimestamp;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly priceStep: number;
  readonly levels:
  readonly FootprintLevelData[];
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;

  readonly analysis:
  SerializedCandle["analysis"];
}

export function toFootprintSeriesData(
  candle: SerializedCandle
): FootprintSeriesData {
  const footprintCandle =
    deserializeFootprintCandle(
      candle
    );

  const volumeProfile =
    createVolumeProfile(
      footprintCandle
    );

  return {
    time: Math.floor(
      candle.startTime / 1_000
    ) as UTCTimestamp,

    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    priceStep: candle.priceStep,
    levels: candle.levels,
    analysis: candle.analysis,

    valueAreaHigh:
      volumeProfile.valueAreaHigh,

    valueAreaLow:
      volumeProfile.valueAreaLow
  };
}