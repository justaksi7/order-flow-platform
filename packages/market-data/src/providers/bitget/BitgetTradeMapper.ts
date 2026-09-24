import type { Market, Trade } from "@orderflow/domain";
import type {
  BitgetRestTradeData,
  BitgetTradeData
} from "./types.js";

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

export function mapBitgetRestTrade(
  data: BitgetRestTradeData,
  market: Market
): Trade {
  return mapBitgetTrade(
    {
      i: data.tradeId,
      p: data.price,
      v: data.size,
      S: data.side,
      T: data.ts
    },
    market
  );
}
