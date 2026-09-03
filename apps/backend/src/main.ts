import type { Candle, Trade,FootprintCandle } from "@orderflow/domain";
import { BitgetMarketDataProvider } from "@orderflow/market-data";
import { getMarket } from "@orderflow/markets";
import {getCandleStartTime, getCandleEndTime,createCandle, updateCandle, CandleBuilder,
  getPriceLevel, createFootprintLevel, updateFootprintLevel, createFootprintCandle,
  updateFootprintCandle, FootprintCandleBuilder
} from "@orderflow/domain";


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
    printFootprintCandle(result.completedCandle);
  }
}

await provider.subscribeTrades(market,handleTrade);
