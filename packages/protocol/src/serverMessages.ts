import type {
  SerializedFootprintCandle
} from "@orderflow/domain";

export type ConnectedMessage = {
  readonly type: "CONNECTED";
  readonly message: string;
};

export type SnapshotMessage = {
  readonly type: "SNAPSHOT";
  readonly candles: readonly SerializedFootprintCandle[];
};

export type CandleCompletedMessage = {
  readonly type: "CANDLE_COMPLETED";
  readonly candle: SerializedFootprintCandle;
};

export type ServerMessage =
  | ConnectedMessage
  | CandleCompletedMessage
  | SnapshotMessage;
