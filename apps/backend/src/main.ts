import type { Candle, Trade } from "@orderflow/domain";
import { BitgetMarketDataProvider } from "@orderflow/market-data";
import { getMarket } from "@orderflow/markets";
import {getCandleStartTime, getCandleEndTime,createCandle, updateCandle, CandleBuilder} from "@orderflow/domain";

// const candleStart = new Date("2026-09-03T12:00:00.000Z").getTime();

// const trade1: Trade = {
//   id: "trade-1",
//   exchange: "BITGET",
//   marketId: "bitget-btc-usdt",
//   symbol: "BTCUSDT",
//   timestamp: candleStart,
//   price: 30_000,
//   quantity: 0.5,
//   side: "BUY"
// };

// const trade2: Trade = {
//   id: "trade-2",
//   exchange: "BITGET",
//   marketId: "bitget-btc-usdt",
//   symbol: "BTCUSDT",
//   timestamp: candleStart + 30_000,
//   price: 30_100,
//   quantity: 0.3,
//   side: "BUY"
// };

// const trade3: Trade = {
//   id: "trade-3",
//   exchange: "BITGET",
//   marketId: "bitget-btc-usdt",
//   symbol: "BTCUSDT",
//   timestamp: candleStart + 60_000,
//   price: 30_050,
//   quantity: 0.2,
//   side: "SELL"
// };

// const builder = new CandleBuilder("bitget-btc-usdt", "1m");
// const result1 = builder.addTrade(trade1);

// console.log("Result 1:", result1);

// const result2 = builder.addTrade(trade2);

// console.log("Result 2:", result2);

// const result3 = builder.addTrade(trade3);

// console.log("Result 3:", result3);



const marketId = process.env.MARKET_ID ?? "bitget-btc-usdt";
const market = getMarket(marketId);
const provider = new BitgetMarketDataProvider();

function printTrade(trade: Trade): void {
  const time = new Date(trade.timestamp).toISOString().slice(11, 23);
  const side = trade.side.padEnd(4);
  const price = trade.price.toFixed(market.display.priceDecimals).padStart(12);
  const quantity = trade.quantity.toFixed(market.display.quantityDecimals).padStart(10);
  console.log(`${time}  ${side}  ${trade.symbol.padEnd(9)}  ${price}  ${quantity}`);
}

function printCandle(candle: Candle): void {
  const startTime = new Date(candle.startTime).toISOString().slice(11, 23);
  const endTime = new Date(candle.endTime).toISOString().slice(11, 23);
  const open = candle.open.toFixed(market.display.priceDecimals).padStart(12);
  const high = candle.high.toFixed(market.display.priceDecimals).padStart(12);
  const low = candle.low.toFixed(market.display.priceDecimals).padStart(12);
  const close = candle.close.toFixed(market.display.priceDecimals).padStart(12);
  const volume = candle.volume.toFixed(market.display.quantityDecimals).padStart(10);
  const tradeCount = candle.tradeCount.toString().padStart(5);
  console.log(`${startTime}  ${endTime}  ${open}  ${high}  ${low}  ${close}  ${volume}  ${tradeCount}`);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Closing connection...`);
  await provider.disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Connecting to Bitget for ${market.symbol}...`);
await provider.connect();

const candleBuilder = new CandleBuilder(market.id, "1m");

function handleTrade(trade: Trade): void {
  const result = candleBuilder.addTrade(trade);

  if (result.completedCandle) {
    printCandle(result.completedCandle);
  }
}

console.log(
  "TIME RANGE                         OPEN          HIGH           LOW         CLOSE      VOLUME  TRADES"
);
await provider.subscribeTrades(market,handleTrade);
