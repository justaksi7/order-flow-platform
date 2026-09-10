import type {
  ServerMessage
} from "@orderflow/protocol";

function isServerMessage(
  value: unknown
): value is ServerMessage {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const type = (
    value as { type?: unknown }
  ).type;

  return (
    type === "CONNECTED" ||
    type === "SNAPSHOT" ||
    type === "CURRENT_CANDLE" ||
    type === "CANDLE_COMPLETED"
  );
}

export function createOrderFlowSocket(
  url: string,
  onMessage: (message: ServerMessage) => void
): WebSocket {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log("Connected to Order Flow backend.");
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      console.error(
        "Unsupported WebSocket message format."
      );

      return;
    }

    try {
      const parsedMessage: unknown =
        JSON.parse(event.data);

      if (!isServerMessage(parsedMessage)) {
        console.error(
          "Unknown server message:",
          parsedMessage
        );

        return;
      }

      onMessage(parsedMessage);
    } catch (error) {
      console.error(
        "Invalid WebSocket message:",
        error
      );
    }
  });

  socket.addEventListener("close", (event) => {
    console.log(
      `WebSocket closed: ${event.code} ${event.reason}`
    );
  });

  socket.addEventListener("error", () => {
    console.error("WebSocket connection error.");
  });

  return socket;
}