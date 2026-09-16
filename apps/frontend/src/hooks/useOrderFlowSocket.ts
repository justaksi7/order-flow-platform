import {
  useEffect,
  useState
} from "react";

import type {
  ServerMessage
} from "@orderflow/protocol";

import {
  createOrderFlowSocket
} from "../websocket/createOrderFlowSocket.js";

const MAX_STORED_CANDLES = 200;

type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

type SnapshotMessage = Extract<
  ServerMessage,
  { type: "SNAPSHOT" }
>;

type SerializedCandle =
  SnapshotMessage["candles"][number];

type StreamState = {
  readonly url: string;
  readonly connectionStatus: ConnectionStatus;
  readonly candles: SerializedCandle[];
  readonly currentCandle: SerializedCandle | null;
};

const EMPTY_CANDLES: SerializedCandle[] = [];

function createInitialState(url: string): StreamState {
  return {
    url,
    connectionStatus: "connecting",
    candles: [],
    currentCandle: null
  };
}

export function useOrderFlowSocket(url: string) {
  const [state, setState] = useState<StreamState>(
    () => createInitialState(url)
  );

  useEffect(() => {
    let active = true;

    setState(createInitialState(url));

    function handleMessage(message: ServerMessage): void {
      if (!active) {
        return;
      }

      setState((previous) => {
        if (!active || previous.url !== url) {
          return previous;
        }

        switch (message.type) {
          case "CONNECTED":
            return {
              ...previous,
              connectionStatus: "connected"
            };

          case "SNAPSHOT":
            return {
              ...previous,
              candles: [...message.candles]
                .sort(
                  (first, second) =>
                    first.startTime - second.startTime
                )
                .slice(-MAX_STORED_CANDLES),
              currentCandle: null
            };

          case "CURRENT_CANDLE":
            return {
              ...previous,
              currentCandle: message.candle
            };

          case "CANDLE_COMPLETED": {
            const candles = [
              ...previous.candles.filter(
                (candle) =>
                  candle.startTime !==
                  message.candle.startTime
              ),
              message.candle
            ]
              .sort(
                (first, second) =>
                  first.startTime - second.startTime
              )
              .slice(-MAX_STORED_CANDLES);

            const currentCandle =
              previous.currentCandle &&
              previous.currentCandle.startTime >
                message.candle.startTime
                ? previous.currentCandle
                : null;

            return {
              ...previous,
              candles,
              currentCandle
            };
          }

          default:
            return previous;
        }
      });
    }

    const socket = createOrderFlowSocket(
      url,
      handleMessage
    );

    function handleClose(): void {
      if (!active) {
        return;
      }

      setState((previous) =>
        previous.url === url
          ? {
              ...previous,
              connectionStatus: "disconnected"
            }
          : previous
      );
    }

    socket.addEventListener("close", handleClose);

    return () => {
      active = false;

      socket.removeEventListener(
        "close",
        handleClose
      );

      socket.close(1000, "Market changed or unmounted");
    };
  }, [url]);

  // Beim URL-Wechsel schon vor Ausführung des Effects
  // keine Daten des vorherigen Marktes zurückgeben.
  if (state.url !== url) {
    return {
      connectionStatus: "connecting" as ConnectionStatus,
      candles: EMPTY_CANDLES,
      currentCandle: null
    };
  }

  return {
    connectionStatus: state.connectionStatus,
    candles: state.candles,
    currentCandle: state.currentCandle
  };
}