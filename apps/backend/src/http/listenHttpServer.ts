import type {
  Server
} from "node:http";

export function listenHttpServer(
  server: Server,
  port: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    function handleError(error: Error): void {
      server.off("listening", handleListening);
      reject(error);
    }

    function handleListening(): void {
      server.off("error", handleError);
      resolve();
    }

    server.once("error", handleError);
    server.once("listening", handleListening);

    server.listen(port);
  });
}