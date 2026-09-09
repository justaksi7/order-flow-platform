import type {
  WebSocketServer
} from "ws";

export function closeWebSocketServer(
  webSocketServer: WebSocketServer
): Promise<void> {
  for (const client of webSocketServer.clients) {
    client.close(
      1001,
      "Server shutting down"
    );
  }

  return new Promise<void>((resolve, reject) => {
    webSocketServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}