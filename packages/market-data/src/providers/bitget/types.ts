export interface BitgetSubscriptionArg {
  readonly instType: "usdt-futures";
  readonly topic: "publicTrade";
  readonly symbol: string;
}

export interface BitgetTradeData {
  readonly i: string;
  readonly p: string;
  readonly v: string;
  readonly S: "buy" | "sell";
  readonly T: string;
}

export interface BitgetRestTradeData {
  readonly tradeId: string;
  readonly price: string;
  readonly size: string;
  readonly side: "buy" | "sell";
  readonly ts: string;
}

export interface BitgetTradeMessage {
  readonly arg: BitgetSubscriptionArg;
  readonly action: "snapshot" | "update";
  readonly data: readonly BitgetTradeData[];
  readonly ts: number;
}

export interface BitgetEventMessage {
  readonly event: "subscribe" | "unsubscribe" | "error";
  readonly arg?: BitgetSubscriptionArg;
  readonly code?: string;
  readonly msg?: string;
}
