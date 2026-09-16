import WebSocket, {
  type WebSocketServer
} from "ws";

import type {
  ServerMessage
} from "@orderflow/protocol";

const clientMarkets = new WeakMap<WebSocket, string>();

export function registerClientMarket(
  client: WebSocket,
  marketId: string
): void {
  clientMarkets.set(client, marketId);
}

export function broadcastServerMessage(
  server: WebSocketServer,
  marketId: string,
  message: ServerMessage
): void {
  const serializedMessage = JSON.stringify(message);

  for (const client of server.clients) {
    if (
      client.readyState !== WebSocket.OPEN ||
      clientMarkets.get(client) !== marketId
    ) {
      continue;
    }

    client.send(serializedMessage);
  }
}