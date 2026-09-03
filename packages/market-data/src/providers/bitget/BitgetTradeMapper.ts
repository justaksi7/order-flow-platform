import type { Market, Trade } from "@orderflow/domain";
import type { BitgetTradeData } from "./types.js";

export function mapBitgetTrade(data: BitgetTradeData, market: Market): Trade {
  const timestamp = Number(data.T);
  const price = Number(data.p);
  const quantity = Number(data.v);

  if (![timestamp, price, quantity].every(Number.isFinite)) {
    throw new Error(`Invalid trade received for ${market.symbol}`);
  }

  return {
    id: data.i,
    marketId: market.id,
    exchange: "BITGET",
    symbol: market.symbol,
    timestamp,
    price,
    quantity,
    side: data.S === "buy" ? "BUY" : "SELL"
  };
}
