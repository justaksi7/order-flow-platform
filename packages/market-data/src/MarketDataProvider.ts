import type { Market, Trade } from "@orderflow/domain";

export type TradeHandler = (trade: Trade) => void;

export type MarketDataStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

export interface MarketDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeTrades(market: Market, handler: TradeHandler): Promise<void>;
  unsubscribeTrades(market: Market): Promise<void>;
}
