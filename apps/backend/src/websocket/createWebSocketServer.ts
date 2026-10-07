import type { Analytics } from "../analytics/Analytics.js";
import { logError } from "../logging/logger.js";
import {
  WebSocketServer
} from "ws";

import type {
  ConnectedMessage,
  CurrentCandleMessage,
  SnapshotMessage
} from "@orderflow/protocol";

import {
  registerClientMarket
} from "./broadcastServerMessage.js";

import type {
  Server as HttpServer
} from "node:http";

type MarketSnapshot = {
  readonly snapshot: SnapshotMessage;
  readonly currentCandle: CurrentCandleMessage | null;
};

type CreateWebSocketServerOptions = {
  readonly httpServer: HttpServer;
  readonly analytics?: Analytics;
  readonly defaultMarketId: string;

  readonly getMarketSnapshot: (
    marketId: string
  ) => MarketSnapshot | undefined;
};


export function createWebSocketServer({
  httpServer,
  analytics,
  defaultMarketId,
  getMarketSnapshot
}: CreateWebSocketServerOptions): WebSocketServer {
  const server = new WebSocketServer({
  server: httpServer,
  path: "/ws"
});

  server.on("connection", (socket, request) => {
    socket.on("error", (error) => {
      logError("WEBSOCKET_CLIENT_ERROR");
    });

    let marketId: string;

    try {
      const url = new URL(
        request.url ?? "/",
        "http://localhost"
      );

      marketId =
        url.searchParams.get("marketId") ??
        defaultMarketId;
    } catch {
      socket.close(1008, "Invalid market URL");
      return;
    }

    const initialData = getMarketSnapshot(marketId);

    if (!initialData) {
      socket.close(1008, "Unknown market");
      return;
    }

    try { analytics?.record("websocket", "/ws"); }
    catch { logError("ANALYTICS_WRITE_FAILED"); }
    registerClientMarket(socket, marketId);

    const connectedMessage: ConnectedMessage = {
      type: "CONNECTED",
      message: `Connected to ${marketId}`
    };

    socket.send(JSON.stringify(connectedMessage));
    socket.send(JSON.stringify(initialData.snapshot));

    if (initialData.currentCandle) {
      socket.send(
        JSON.stringify(initialData.currentCandle)
      );
    }


  });

  return server;
}