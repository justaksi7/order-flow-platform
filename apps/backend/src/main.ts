import type {
  FootprintCandle,
  Trade
} from "@orderflow/domain";

import {
  FootprintCandleBuffer,
  FootprintCandleBuilder,
  getCandleVwap
} from "@orderflow/domain";

import {
  BitgetMarketDataProvider
} from "@orderflow/market-data";

import { getMarket } from "@orderflow/markets";

const BUFFER_CAPACITY = 1_440;
const FOOTPRINT_TICK_SIZE = 0.1;

const marketId =
  process.env.MARKET_ID ?? "bitget-btc-usdt";

const market = getMarket(marketId);
const provider = new BitgetMarketDataProvider();

const candleBuffer =
  new FootprintCandleBuffer(BUFFER_CAPACITY);

const footprintCandleBuilder =
  new FootprintCandleBuilder(
    market.id,
    "1m",
    FOOTPRINT_TICK_SIZE
  );

function printFootprintCandle(
  candle: FootprintCandle
): void {
  const priceDecimals =
    market.display.priceDecimals;

  const quantityDecimals =
    market.display.quantityDecimals;

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

  let totalBidVolume = 0;
  let totalAskVolume = 0;

  for (const level of candle.levels.values()) {
    totalBidVolume += level.bidVolume;
    totalAskVolume += level.askVolume;
  }

  const totalDelta =
    totalAskVolume - totalBidVolume;

  console.log("\nFOOTPRINT CANDLE");

  console.log(
    `${startTime} - ${endTime} | ` +
      `O: ${open} H: ${high} ` +
      `L: ${low} C: ${close} ` +
      `V: ${volume} Trades: ${tradeCount}`
  );

  console.log(
    "       PRICE |        BID |        ASK |" +
      "      DELTA | TRADES"
  );

  console.log(
    "-------------|------------|------------|" +
      "------------|-------"
  );

  const sortedLevels = [
    ...candle.levels.values()
  ].sort(
    (first, second) =>
      second.price - first.price
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

    const delta = (
      level.askVolume - level.bidVolume
    )
      .toFixed(quantityDecimals)
      .padStart(11);

    const levelTradeCount = level.tradeCount
      .toString()
      .padStart(6);

    console.log(
      `${price} |${bidVolume} |${askVolume} |` +
        `${delta} |${levelTradeCount}`
    );
  }

  console.log(
    `Total Bid: ` +
      `${totalBidVolume.toFixed(quantityDecimals)} | ` +
      `Total Ask: ` +
      `${totalAskVolume.toFixed(quantityDecimals)} | ` +
      `Delta: ${totalDelta.toFixed(quantityDecimals)}`
  );

  console.log(
    `VWAP: ${getCandleVwap(candle).toFixed(
      priceDecimals
    )}`
  );
}

function handleTrade(trade: Trade): void {
  const result =
    footprintCandleBuilder.addTrade(trade);

  if (!result.completedCandle) {
    return;
  }

  candleBuffer.add(result.completedCandle);

  console.log(
    `\nCandles im Buffer: ` +
      `${candleBuffer.size}/${BUFFER_CAPACITY}`
  );

  printFootprintCandle(
    result.completedCandle
  );
}

let isShuttingDown = false;

async function shutdown(
  signal: string
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\n${signal} received. Closing connection...`
  );

  try {
    await provider.disconnect();
    console.log("Connection closed.");
  } catch (error) {
    console.error(
      "Error while closing connection:",
      error
    );

    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

process.once(
  "SIGINT",
  () => void shutdown("SIGINT")
);

process.once(
  "SIGTERM",
  () => void shutdown("SIGTERM")
);

async function main(): Promise<void> {
  console.log(
    `Connecting to Bitget for ${market.symbol}...`
  );

  await provider.connect();

  console.log(
    `Connected. Subscribing to ${market.symbol} trades...`
  );

  await provider.subscribeTrades(
    market,
    handleTrade
  );
}

try {
  await main();
} catch (error) {
  console.error("Backend startup failed:", error);

  try {
    await provider.disconnect();
  } catch (disconnectError) {
    console.error(
      "Error while disconnecting:",
      disconnectError
    );
  }

  process.exitCode = 1;
}