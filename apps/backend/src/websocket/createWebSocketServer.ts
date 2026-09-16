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
  readonly defaultMarketId: string;

  readonly getMarketSnapshot: (
    marketId: string
  ) => MarketSnapshot | undefined;
};


export function createWebSocketServer({
  httpServer,
  defaultMarketId,
  getMarketSnapshot
}: CreateWebSocketServerOptions): WebSocketServer {
  const server = new WebSocketServer({
    server: httpServer
  });

  server.on("connection", (socket, request) => {
    socket.on("error", (error) => {
      console.error("WebSocket client error:", error);
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

    console.log(
      `WebSocket client connected: ${marketId}`
    );

    socket.on("close", () => {
      console.log(
        `WebSocket client disconnected: ${marketId}`
      );
    });
  });

  return server;
}