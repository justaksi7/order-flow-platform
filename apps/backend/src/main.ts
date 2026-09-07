import type { Candle, Trade,FootprintCandle } from "@orderflow/domain";
import { BitgetMarketDataProvider } from "@orderflow/market-data";
import { getMarket } from "@orderflow/markets";
import {getCandleStartTime, getCandleEndTime,createCandle, updateCandle, CandleBuilder,
  getPriceLevel, createFootprintLevel, updateFootprintLevel, createFootprintCandle,
  updateFootprintCandle, FootprintCandleBuilder, getCandleVwap, aggregateFootprintCandles
} from "@orderflow/domain";
import { FootprintCandleBuffer } from "./FootprintCandleBuffer.js";


const marketId = process.env.MARKET_ID ?? "bitget-btc-usdt";
const market = getMarket(marketId);
const provider = new BitgetMarketDataProvider();
const candleBuffer = new FootprintCandleBuffer(60);

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

function printFootprintCandle(candle: FootprintCandle): void {
  const priceDecimals = market.display.priceDecimals;
  const quantityDecimals = market.display.quantityDecimals;

  const startTime = new Date(candle.startTime)
    .toISOString()
    .slice(11, 23);

  const endTime = new Date(candle.endTime)
    .toISOString()
    .slice(11, 23);

  const open = candle.open
    .toFixed(priceDecimals)
    .padStart(12);

  const high = candle.high
    .toFixed(priceDecimals)
    .padStart(12);

  const low = candle.low
    .toFixed(priceDecimals)
    .padStart(12);

  const close = candle.close
    .toFixed(priceDecimals)
    .padStart(12);

  const volume = candle.volume
    .toFixed(quantityDecimals)
    .padStart(10);

  const tradeCount = candle.tradeCount
    .toString()
    .padStart(6);

  const totalBidVolume = [...candle.levels.values()].reduce((sum, level) => sum + level.bidVolume, 0);
  const totalAskVolume = [...candle.levels.values()].reduce((sum, level) => sum + level.askVolume, 0);
  const totalDelta = totalAskVolume - totalBidVolume;

  console.log("\nFOOTPRINT CANDLE");
  console.log(
    `${startTime} - ${endTime} | ` +
    `O: ${open} H: ${high} L: ${low} C: ${close} ` +
    `V: ${volume} Trades: ${tradeCount}`
  );

  console.log("       PRICE |        BID |        ASK |      DELTA | TRADES");
  console.log("-------------|------------|------------|------------|-------");

  const sortedLevels = [...candle.levels.values()].sort(
    (a, b) => b.price - a.price
  );

  for (const level of sortedLevels) {
    const price = level.price
      .toFixed(priceDecimals)
      .padStart(12);

    const bidVolume = level.bidVolume
      .toFixed(quantityDecimals)
      .padStart(11);

    const askVolume = level.askVolume
      .toFixed(quantityDecimals)
      .padStart(11);

    const delta = (level.askVolume - level.bidVolume)
      .toFixed(quantityDecimals)
      .padStart(11);

    const levelTradeCount = level.tradeCount
      .toString()
      .padStart(6);

    console.log(
      `${price} |${bidVolume} |${askVolume} |${delta} |${levelTradeCount}`
    );  
  }
  console.log(
  `Total Bid: ${totalBidVolume.toFixed(quantityDecimals)} | ` +
  `Total Ask: ${totalAskVolume.toFixed(quantityDecimals)} | ` +
  `Delta: ${totalDelta.toFixed(quantityDecimals)}`
);
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
const footprintCandleBuilder = new FootprintCandleBuilder(market.id, "1m",0.1);
function handleTrade(trade: Trade): void {
  const result = footprintCandleBuilder.addTrade(trade);
    if (result.completedCandle) {
        candleBuffer.add(result.completedCandle);
        console.log(
    `Candles im Buffer: ${candleBuffer.size}/60`
  );
}
      printFootprintCandle(result.currentCandle);
        console.log(
          "VWAP:",
          result.currentCandle.quoteVolume / result.currentCandle.volume
);
}

// await provider.subscribeTrades(market,handleTrade);
const startTime = new Date(
  "2026-09-07T12:00:00.000Z"
).getTime();

const trade1: Trade = {
  id: "trade-1",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 10_000,
  price: 100,
  quantity: 2,
  side: "BUY"
};

const trade2: Trade = {
  id: "trade-2",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 20_000,
  price: 101,
  quantity: 1,
  side: "SELL"
};

const trade3: Trade = {
  id: "trade-3",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 70_000,
  price: 100,
  quantity: 3,
  side: "SELL"
};

const trade4: Trade = {
  id: "trade-4",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 80_000,
  price: 102,
  quantity: 1,
  side: "BUY"
};

let candle1 = createFootprintCandle(
  trade1,
  "1m",
  1
);

candle1 = updateFootprintCandle(
  candle1,
  trade2,
  1
);

let candle2 = createFootprintCandle(
  trade3,
  "1m",
  1
);

candle2 = updateFootprintCandle(
  candle2,
  trade4,
  1
);

const aggregated = aggregateFootprintCandles(
  [candle1, candle2],
  "5m"
);

console.log("Aggregierte Candle:");
console.log(aggregated);

console.log("VWAP:", getCandleVwap(aggregated));
console.log("Level 100:", aggregated.levels.get(100));
console.log("Level 101:", aggregated.levels.get(101));
console.log("Level 102:", aggregated.levels.get(102));

console.assert(aggregated.timeFrame === "5m");
console.assert(aggregated.startTime === startTime);
console.assert(aggregated.endTime === startTime + 5 * 60_000);

console.assert(aggregated.open === 100);
console.assert(aggregated.high === 102);
console.assert(aggregated.low === 100);
console.assert(aggregated.close === 102);

console.assert(aggregated.volume === 7);
console.assert(aggregated.quoteVolume === 703);
console.assert(aggregated.tradeCount === 4);
console.assert(aggregated.levels.size === 3);

console.assert(aggregated.levels.get(100)?.bidVolume === 3);
console.assert(aggregated.levels.get(100)?.askVolume === 2);
console.assert(aggregated.levels.get(100)?.tradeCount === 2);

const vwap = getCandleVwap(aggregated);

console.assert(
  Math.abs(vwap - 100.42857142857143) < 0.000001
);