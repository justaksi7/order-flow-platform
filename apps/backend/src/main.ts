import type {
  FootprintCandle,
  Trade
} from "@orderflow/domain";

import {
  FootprintCandleBuffer,
  FootprintCandleBuilder,
  getCandleVwap,
  serializeFootprintCandle
} from "@orderflow/domain";

import {
  closeWebSocketServer
} from "./websocket/closeWebSocketServer.js";

import {
  BitgetMarketDataProvider
} from "@orderflow/market-data";

import { getMarket } from "@orderflow/markets";

import { createWebSocketServer } from "../src/websocket/createWebSocketServer.js";

import {
  createSnapshotMessage
} from "./websocket/createSnapshotMessage.js";
import { WebSocketServer } from "ws";
import {
  CandleCompletedMessage,
  CurrentCandleMessage,
} from "@orderflow/protocol";
import { broadcastServerMessage } from "./websocket/broadcastServerMessage.js";

const WEB_SOCKET_PORT = 8080;


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
const CURRENT_CANDLE_BROADCAST_INTERVAL_MS = 250;

let lastCurrentCandleBroadcastTime = 0;

function handleTrade(
  trade: Trade,
  webSocketServer: WebSocketServer
): void {
  const result =
    footprintCandleBuilder.addTrade(trade);

  if (result.completedCandle) {
    candleBuffer.add(result.completedCandle);

    const candleCompletedMessage:
      CandleCompletedMessage = {
      type: "CANDLE_COMPLETED",
      candle: serializeFootprintCandle(
        result.completedCandle
      )
    };

    broadcastServerMessage(
      webSocketServer,
      candleCompletedMessage
    );

    console.log(
      `\nCandles im Buffer: ` +
      `${candleBuffer.size}/${BUFFER_CAPACITY}`
    );

    printFootprintCandle(
      result.completedCandle
    );
  }

  const now = Date.now();

  if (
    now - lastCurrentCandleBroadcastTime <
    CURRENT_CANDLE_BROADCAST_INTERVAL_MS
  ) {
    return;
  }

  const currentCandleMessage:
    CurrentCandleMessage = {
    type: "CURRENT_CANDLE",
    candle: serializeFootprintCandle(
      result.currentCandle
    )
  };

  broadcastServerMessage(
    webSocketServer,
    currentCandleMessage
  );

  lastCurrentCandleBroadcastTime = now;
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
    `\n${signal} received. Closing connections...`
  );

  try {
    await provider.disconnect();
    console.log("Market-data connection closed.");
  } catch (error) {
    console.error(
      "Error while closing market-data connection:",
      error
    );

    process.exitCode = 1;
  }

  if (webSocketServer) {
    try {
      await closeWebSocketServer(
        webSocketServer
      );

      webSocketServer = undefined;

      console.log("WebSocket server closed.");
    } catch (error) {
      console.error(
        "Error while closing WebSocket server:",
        error
      );

      process.exitCode = 1;
    }
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

let webSocketServer:
  WebSocketServer | undefined;

async function main(): Promise<void> {
  const server = createWebSocketServer(
    WEB_SOCKET_PORT,
    () => createSnapshotMessage(
      candleBuffer.getAll()
    )
  );

  webSocketServer = server;

  await provider.connect();

  console.log(
    `Connected. Subscribing to ${market.symbol} trades...`
  );

  await provider.subscribeTrades(
    market,
    (trade) => handleTrade(
      trade,
      server
    )
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