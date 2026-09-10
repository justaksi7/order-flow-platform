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

export function useOrderFlowSocket(
  url: string
) {
  const [
    connectionStatus,
    setConnectionStatus
  ] = useState<ConnectionStatus>("connecting");

  const [
    candles,
    setCandles
  ] = useState<SerializedCandle[]>([]);

  const [
    currentCandle,
    setCurrentCandle
  ] = useState<SerializedCandle | null>(null);

  useEffect(() => {
    setConnectionStatus("connecting");

    function handleMessage(
      message: ServerMessage
    ): void {
      switch (message.type) {
        case "CONNECTED":
          setConnectionStatus("connected");
          break;

        case "SNAPSHOT":
          setCandles(message.candles.slice(-MAX_STORED_CANDLES));
          break;

        case "CURRENT_CANDLE":
          setCurrentCandle(message.candle);
          break;

        case "CANDLE_COMPLETED":
          setCandles((previousCandles) => [
            ...previousCandles,
            message.candle
          ].slice(-MAX_STORED_CANDLES));

          setCurrentCandle(null);
          break;
      }
    }

    const socket = createOrderFlowSocket(
      url,
      handleMessage
    );

    function handleClose(): void {
      setConnectionStatus("disconnected");
    }

    socket.addEventListener(
      "close",
      handleClose
    );

    return () => {
      socket.removeEventListener(
        "close",
        handleClose
      );

      socket.close(
        1000,
        "Component unmounted"
      );
    };
  }, [url]);

  return {
    connectionStatus,
    candles,
    currentCandle
  };
}