import type {
  SerializedAnalyzedFootprintCandle
} from "@orderflow/domain";

export type ConnectedMessage = {
  readonly type: "CONNECTED";
  readonly message: string;
};

export type MarketDataStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "recovering";

export type MarketDataStatusMessage = {
  readonly type: "MARKET_DATA_STATUS";
  readonly marketId: string;
  readonly status: MarketDataStatus;
};

export type SnapshotMessage = {
  readonly type: "SNAPSHOT";

  readonly candles:
  readonly SerializedAnalyzedFootprintCandle[];
};

export type CandleCompletedMessage = {
  readonly type: "CANDLE_COMPLETED";

  readonly candle:
  SerializedAnalyzedFootprintCandle;
};

export type CurrentCandleMessage = {
  readonly type: "CURRENT_CANDLE";

  readonly candle:
  SerializedAnalyzedFootprintCandle;
};

export type ServerMessage =
  | ConnectedMessage
  | MarketDataStatusMessage
  | CandleCompletedMessage
  | CurrentCandleMessage
  | SnapshotMessage;
