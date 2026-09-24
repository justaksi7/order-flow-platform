import type {
  FootprintCandle,
  Market,
  Trade
} from "@orderflow/domain";

import {
  FootprintCandleBuffer,
  FootprintCandleBuilder,
  getCandleVwap,
  serializeAnalyzedFootprintCandle
} from "@orderflow/domain";

import {
  BitgetMarketDataProvider,
  type MarketDataStatus
} from "@orderflow/market-data";

import {
  getMarket
} from "@orderflow/markets";

import type {
  CandleCompletedMessage,
  CurrentCandleMessage,
  MarketDataStatusMessage
} from "@orderflow/protocol";

import type {
  WebSocketServer
} from "ws";

import {
  broadcastServerMessage
} from "./websocket/broadcastServerMessage.js";

import {
  closeWebSocketServer
} from "./websocket/closeWebSocketServer.js";

import {
  createSnapshotMessage
} from "./websocket/createSnapshotMessage.js";

import {
  createWebSocketServer
} from "./websocket/createWebSocketServer.js";

import {
  createServer
} from "node:http";

import type {
  Server as HttpServer
} from "node:http";

import {
  createHttpApp
} from "./http/createHttpApp.js";

import {
  listenHttpServer
} from "./http/listenHttpServer.js";

import {
  closeHttpServer
} from "./http/closeHttpServer.js";

// Konfiguration

const SERVER_PORT = 8080;
const CANDLE_RETENTION_MS =
  48 * 60 * 60 * 1_000;
const SNAPSHOT_CANDLE_LIMIT = 200;
const CURRENT_CANDLE_BROADCAST_INTERVAL_MS = 250;
const DEFAULT_MARKET_ID =
  process.env.MARKET_ID ?? "bitget-btc-usdt";

type MarketRuntimeConfig = {
  readonly marketId: string;
  readonly footprintPriceStep: number;
};

const MARKET_CONFIGS: readonly MarketRuntimeConfig[] = [
  {
    marketId: "bitget-btc-usdt",
    footprintPriceStep: 100
  },
  {
    marketId: "bitget-eth-usdt",
    footprintPriceStep: 10
  },
  {
    marketId: "bitget-xau-usdt",
    footprintPriceStep: 10
  }
];

// Laufzeitzustand

type MarketRuntime = {
  readonly market: Market;
  readonly candleBuffer: FootprintCandleBuffer;
  readonly candleBuilder: FootprintCandleBuilder;
  currentCandle: FootprintCandle | null;
  lastCurrentCandleBroadcastTime: number;
  lastTradeTimestamp: number | undefined;
  isRecovering: boolean;
  queuedTrades: Trade[];
};

let webSocketServer: WebSocketServer | undefined;
let httpServer: HttpServer | undefined;
let isShuttingDown = false;
let shutdownPromise: Promise<void> | undefined;
let activeRuntimes = new Map<string, MarketRuntime>();

function broadcastMarketDataStatus(
  status: MarketDataStatus | "recovering"
): void {
  if (!webSocketServer) {
    return;
  }

  for (const runtime of activeRuntimes.values()) {
    const message: MarketDataStatusMessage = {
      type: "MARKET_DATA_STATUS",
      marketId: runtime.market.id,
      status
    };

    broadcastServerMessage(
      webSocketServer,
      runtime.market.id,
      message
    );
  }
}

const provider = new BitgetMarketDataProvider(
  undefined,
  (status) => {
    broadcastMarketDataStatus(status);

    if (status === "connected" && webSocketServer) {
      void recoverMarketData();
    }
  }
);

// Marktverwaltung

function createMarketRuntime(
  config: MarketRuntimeConfig
): MarketRuntime {
  const market = getMarket(config.marketId);

  return {
    market,
    candleBuffer: new FootprintCandleBuffer({
      retentionMs: CANDLE_RETENTION_MS
    }),
    candleBuilder: new FootprintCandleBuilder(
      market.id,
      "1m",
      config.footprintPriceStep
    ),
    currentCandle: null,
    lastCurrentCandleBroadcastTime: 0,
    lastTradeTimestamp: undefined,
    isRecovering: false,
    queuedTrades: []
  };
}

function createMarketRuntimes(): Map<string, MarketRuntime> {
  const runtimes = new Map<string, MarketRuntime>();

  for (const config of MARKET_CONFIGS) {
    const runtime = createMarketRuntime(config);
    runtimes.set(runtime.market.id, runtime);
  }

  return runtimes;
}

function getSelectedMarketConfig(): MarketRuntimeConfig {
  const marketId =
    process.env.MARKET_ID ?? "bitget-btc-usdt";

  const config = MARKET_CONFIGS.find(
    (candidate) => candidate.marketId === marketId
  );

  if (!config) {
    throw new Error(
      `Unsupported MARKET_ID: ${marketId}. ` +
      `Available markets: ${MARKET_CONFIGS.map(
        (candidate) => candidate.marketId
      ).join(", ")
      }`
    );
  }

  return config;
}

// Logging

function printFootprintCandle(
  candle: FootprintCandle,
  market: Market
): void {
  const {
    priceDecimals,
    quantityDecimals
  } = market.display;

  const startTime =
    new Date(candle.startTime).toISOString();

  const endTime =
    new Date(candle.endTime).toISOString();

  console.log(
    `\n[${market.symbol}] ${startTime} – ${endTime}`
  );

  console.log(
    `O: ${candle.open.toFixed(priceDecimals)} | ` +
    `H: ${candle.high.toFixed(priceDecimals)} | ` +
    `L: ${candle.low.toFixed(priceDecimals)} | ` +
    `C: ${candle.close.toFixed(priceDecimals)} | ` +
    `V: ${candle.volume.toFixed(quantityDecimals)} | ` +
    `Trades: ${candle.tradeCount}`
  );

  const levels = [...candle.levels.values()].sort(
    (first, second) => second.price - first.price
  );

  console.table(
    levels.map((level) => ({
      Price: level.price.toFixed(priceDecimals),
      Bid: level.bidVolume.toFixed(quantityDecimals),
      Ask: level.askVolume.toFixed(quantityDecimals),
      Delta: (
        level.askVolume - level.bidVolume
      ).toFixed(quantityDecimals),
      Trades: level.tradeCount
    }))
  );

  let totalBidVolume = 0;
  let totalAskVolume = 0;

  for (const level of levels) {
    totalBidVolume += level.bidVolume;
    totalAskVolume += level.askVolume;
  }

  console.log(
    `Total Bid: ${totalBidVolume.toFixed(quantityDecimals)} | ` +
    `Total Ask: ${totalAskVolume.toFixed(quantityDecimals)} | ` +
    `Delta: ${(totalAskVolume - totalBidVolume)
      .toFixed(quantityDecimals)
    }`
  );

  if (candle.volume > 0) {
    console.log(
      `VWAP: ${getCandleVwap(candle).toFixed(priceDecimals)}`
    );
  }
}

// Trade-Verarbeitung

function handleTrade(
  trade: Trade,
  runtime: MarketRuntime,
  server: WebSocketServer
): void {
  if (isShuttingDown) {
    return;
  }

  if (runtime.isRecovering) {
    runtime.queuedTrades.push(trade);
    return;
  }

  processTrade(trade, runtime, server);
}

function processTrade(
  trade: Trade,
  runtime: MarketRuntime,
  server: WebSocketServer
): void {
  runtime.lastTradeTimestamp = Math.max(
    runtime.lastTradeTimestamp ?? 0,
    trade.timestamp
  );

  const result = runtime.candleBuilder.addTrade(trade);

  // Immer aktualisieren, unabhängig vom Broadcast-Intervall.
  runtime.currentCandle = result.currentCandle;

  if (result.completedCandle) {
    handleCompletedCandle(
      result.completedCandle,
      runtime,
      server
    );
  }

  const now = Date.now();

  const intervalElapsed =
    now - runtime.lastCurrentCandleBroadcastTime >=
    CURRENT_CANDLE_BROADCAST_INTERVAL_MS;

  // Beim Candle-Wechsel die neue Candle sofort senden.
  if (!result.completedCandle && !intervalElapsed) {
    return;
  }

  const message: CurrentCandleMessage = {
    type: "CURRENT_CANDLE",
    candle: serializeAnalyzedFootprintCandle(
      result.currentCandle
    )
  };

  broadcastServerMessage(
    server,
    runtime.market.id,
    message
  );

  runtime.lastCurrentCandleBroadcastTime = now;
}

async function recoverMarketData(): Promise<void> {
  if (!webSocketServer || isShuttingDown) {
    return;
  }

  const server = webSocketServer;
  const recoveringRuntimes = [...activeRuntimes.values()];

  for (const runtime of recoveringRuntimes) {
    runtime.isRecovering = true;
  }

  broadcastMarketDataStatus("recovering");

  try {
    for (const runtime of recoveringRuntimes) {
      const lastTradeTimestamp = runtime.lastTradeTimestamp;

      if (lastTradeTimestamp === undefined) {
        continue;
      }

      const recoveredTrades = await provider.fetchTradesSince(
        runtime.market,
        lastTradeTimestamp + 1
      );

      const seenTradeIds = new Set<string>();

      for (const trade of recoveredTrades) {
        if (
          trade.timestamp <= lastTradeTimestamp ||
          seenTradeIds.has(trade.id)
        ) {
          continue;
        }

        seenTradeIds.add(trade.id);
        processTrade(trade, runtime, server);
      }

      runtime.queuedTrades
        .sort((first, second) => first.timestamp - second.timestamp)
        .forEach((trade) => processTrade(trade, runtime, server));

      runtime.queuedTrades.length = 0;
    }

    broadcastMarketDataStatus("connected");
  } catch (error) {
    console.error("Market-data gap recovery failed:", error);
    broadcastMarketDataStatus("disconnected");
  } finally {
    for (const runtime of recoveringRuntimes) {
      runtime.isRecovering = false;
    }
  }
}

function handleCompletedCandle(
  candle: FootprintCandle,
  runtime: MarketRuntime,
  server: WebSocketServer
): void {
  runtime.candleBuffer.add(candle);

  const message: CandleCompletedMessage = {
    type: "CANDLE_COMPLETED",
    candle: serializeAnalyzedFootprintCandle(candle)
  };

  broadcastServerMessage(
    server,
    runtime.market.id,
    message
  );

  console.log(
    `[${runtime.market.symbol}] ` +
    `Candles im 48h-Buffer: ` +
    `${runtime.candleBuffer.size}`
  );

  printFootprintCandle(candle, runtime.market);
}

// Shutdown

function shutdown(reason: string): Promise<void> {
  if (!shutdownPromise) {
    isShuttingDown = true;
    shutdownPromise = closeConnections(reason);
  }

  return shutdownPromise;
}

async function closeConnections(
  reason: string
): Promise<void> {
  console.log(`\n${reason}. Closing connections...`);

  const tasks: {
    readonly name: string;
    readonly close: () => Promise<void>;
  }[] = [
    {
      name: "Market-data connection",
      close: () => provider.disconnect()
    }
  ];

  const activeHttpServer = httpServer;

  if (activeHttpServer) {
    tasks.push({
      name: "HTTP server",
      close: () => closeHttpServer(activeHttpServer)
    });
  }

  const activeWebSocketServer = webSocketServer;

  if (activeWebSocketServer) {
    tasks.push({
      name: "WebSocket server",
      close: () =>
        closeWebSocketServer(activeWebSocketServer)
    });
  }

  await Promise.all(
    tasks.map(async (task) => {
      try {
        await task.close();
        console.log(`${task.name} closed.`);
      } catch (error) {
        console.error(
          `Error while closing ${task.name}:`,
          error
        );

        process.exitCode = 1;
      }
    })
  );

  httpServer = undefined;
  webSocketServer = undefined;
}


// Start

async function main(): Promise<void> {
  const runtimes = createMarketRuntimes();
  activeRuntimes = runtimes;

  if (!runtimes.has(DEFAULT_MARKET_ID)) {
    throw new Error(
      `Unsupported MARKET_ID: ${DEFAULT_MARKET_ID}`
    );
  }

  const app = createHttpApp({
    getCandleBuffer: (marketId) =>
      runtimes.get(marketId)?.candleBuffer
  });

  const server = createServer(app);
  httpServer = server;

  const socketServer = createWebSocketServer({
    httpServer: server,
    defaultMarketId: DEFAULT_MARKET_ID,

    getMarketSnapshot: (marketId) => {
      const runtime = runtimes.get(marketId);

      if (!runtime) {
        return undefined;
      }

      const currentCandle: CurrentCandleMessage | null =
        runtime.currentCandle
          ? {
              type: "CURRENT_CANDLE",
              candle: serializeAnalyzedFootprintCandle(
                runtime.currentCandle
              )
            }
          : null;

      return {
        snapshot: createSnapshotMessage(
          runtime.candleBuffer
            .getAll()
            .slice(-SNAPSHOT_CANDLE_LIMIT)
        ),
        currentCandle
      };
    }
  });

  webSocketServer = socketServer;

  await listenHttpServer(server, SERVER_PORT);

  console.log(
    `HTTP and WebSocket server listening on port ${SERVER_PORT}`
  );

  if (isShuttingDown) {
    return;
  }

  await provider.connect();

  if (isShuttingDown) {
    await provider.disconnect();
    return;
  }

  for (const runtime of runtimes.values()) {
    if (isShuttingDown) {
      await provider.disconnect();
      return;
    }

    console.log(
      `Subscribing to ${runtime.market.symbol} trades...`
    );

    await provider.subscribeTrades(
      runtime.market,
      (trade) =>
        handleTrade(
          trade,
          runtime,
          socketServer
        )
    );
  }

  if (isShuttingDown) {
    await provider.disconnect();
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT received");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM received");
});

try {
  await main();
} catch (error) {
  console.error("Backend startup failed:", error);
  process.exitCode = 1;

  await shutdown("Backend startup failed");
}