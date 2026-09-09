import WebSocket, {
  type WebSocketServer
} from "ws";

import type {
  ServerMessage
} from "@orderflow/protocol";

export function broadcastServerMessage(
  webSocketServer: WebSocketServer,
  message: ServerMessage
): void {
  const serializedMessage =
    JSON.stringify(message);

  for (const client of webSocketServer.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(serializedMessage);
  }
}