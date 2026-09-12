import type {
  CustomData,
  Time,
  UTCTimestamp
} from "lightweight-charts";

import type {
  ServerMessage
} from "@orderflow/protocol";

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

  readonly analysis:
  SerializedCandle["analysis"];
}

export function toFootprintSeriesData(
  candle: SerializedCandle
): FootprintSeriesData {
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
    analysis: candle.analysis
  };
}