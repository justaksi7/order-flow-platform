export type Exchange = "BITGET";

export type ProductType = "USDT_FUTURES";

export type TradeSide = "BUY" | "SELL";

export type TimeFrame =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "8h"
  | "12h"
  | "1d";

export interface MarketDisplay {
  readonly priceDecimals: number;
  readonly quantityDecimals: number;
}

export interface Market {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly exchange: Exchange;
  readonly productType: ProductType;
  readonly tickSize: number;
  readonly display: MarketDisplay;
}

export interface Trade {
  readonly id: string;
  readonly marketId: string;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly timestamp: number;
  readonly price: number;
  readonly quantity: number;
  readonly side: TradeSide;
}

export interface Candle {
  readonly marketId: string;
  readonly timeFrame: TimeFrame;
  readonly startTime: number;
  readonly endTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly quoteVolume: number;
  readonly tradeCount: number;
}

export interface FootprintLevel {
  readonly price: number;
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly tradeCount: number;
}

export interface FootprintCandle extends Candle {
  readonly priceStep: number;
  readonly levels:
    ReadonlyMap<number, FootprintLevel>;
}

export interface VolumeProfileLevel extends FootprintLevel {
  readonly volume: number;
  readonly delta: number;
}

export interface VolumeProfile {
  readonly levels: ReadonlyMap<number, VolumeProfileLevel>;
  readonly pocPrice: number;
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly totalVolume: number;
}

export interface CumulativeDeltaPoint {
  readonly startTime: number;
  readonly endTime: number;
  readonly delta: number;
  readonly cumulativeDelta: number;
}

export interface FootprintImbalance {
  readonly price: number;
  readonly side: "BUY" | "SELL";
  readonly dominantVolume: number;
  readonly comparedVolume: number;
  readonly ratio: number | null;
}

export interface StackedImbalance {
  readonly side: "BUY" | "SELL";
  readonly lowPrice: number;
  readonly highPrice: number;
  readonly imbalances: readonly FootprintImbalance[];
}

export interface FootprintCandleAnalysis {
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly delta: number;
  readonly imbalances: readonly FootprintImbalance[];
  readonly stackedImbalances: readonly StackedImbalance[];
}

export type SerializedFootprintCandle = Omit<FootprintCandle, "levels"> & {
  readonly levels: readonly FootprintLevel[];
};

export type SerializedAnalyzedFootprintCandle =
  SerializedFootprintCandle & {
    readonly analysis:
      FootprintCandleAnalysis;
  };