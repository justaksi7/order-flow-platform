import type { Market } from "@orderflow/domain";

const marketList = [
  {
    id: "bitget-btc-usdt",
    name: "Bitcoin",
    symbol: "BTCUSDT",
    exchange: "BITGET",
    productType: "USDT_FUTURES",
    tickSize: 0.1,
    display: { priceDecimals: 1, quantityDecimals: 4 }
  },
  {
    id: "bitget-eth-usdt",
    name: "Ethereum",
    symbol: "ETHUSDT",
    exchange: "BITGET",
    productType: "USDT_FUTURES",
    tickSize: 0.01,
    display: { priceDecimals: 2, quantityDecimals: 3 }
  },
  {
    id: "bitget-xau-usdt",
    name: "Gold",
    symbol: "XAUUSDT",
    exchange: "BITGET",
    productType: "USDT_FUTURES",
    tickSize: 0.01,
    display: { priceDecimals: 2, quantityDecimals: 3 }
  }
] as const satisfies readonly Market[];

export const markets: readonly Market[] = marketList;

export function getMarket(marketId: string): Market {
  const market = markets.find((candidate) => candidate.id === marketId);
  if (!market) {
    throw new Error(`Unknown market: ${marketId}`);
  }
  return market;
}
