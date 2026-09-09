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

export type CurrentCandleMessage = {
  readonly type: "CURRENT_CANDLE";
  readonly candle: SerializedFootprintCandle;
};

export type ServerMessage =
  | ConnectedMessage
  | CandleCompletedMessage
  | CurrentCandleMessage
  | SnapshotMessage;
