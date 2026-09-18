import {
  useEffect,
  useState
} from "react";

import type {
  ServerMessage
} from "@orderflow/protocol";

import type {
  SerializedAnalyzedFootprintCandle
} from "@orderflow/domain";

import {
  createOrderFlowSocket
} from "../websocket/createOrderFlowSocket.js";

import {
  loadCandleHistory
} from "../api/loadCandleHistory.js";

type Candle = SerializedAnalyzedFootprintCandle;

type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

type HistoryStatus =
  | "waiting"
  | "loading"
  | "ready"
  | "error";

type StreamState = {
  readonly url: string;
  readonly connectionStatus: ConnectionStatus;
  readonly historyStatus: HistoryStatus;
  readonly historyError: string | null;
  readonly candles: readonly Candle[];
  readonly currentCandle: Candle | null;
};

const RETENTION_MS = 48 * 60 * 60 * 1_000;

function createInitialState(url: string): StreamState {
  return {
    url,
    connectionStatus: "connecting",
    historyStatus: "waiting",
    historyError: null,
    candles: [],
    currentCandle: null
  };
}

function mergeCandles(
  older: readonly Candle[],
  newer: readonly Candle[]
): Candle[] {
  const cutoff = Date.now() - RETENTION_MS;
  const byStartTime = new Map<number, Candle>();

  // Der zweite Durchlauf überschreibt ältere Versionen.
  for (const source of [older, newer]) {
    for (const candle of source) {
      if (candle.endTime > cutoff) {
        byStartTime.set(candle.startTime, candle);
      }
    }
  }

  return [...byStartTime.values()].sort(
    (first, second) =>
      first.startTime - second.startTime
  );
}

export function useOrderFlowSocket(url: string) {
  const [state, setState] = useState<StreamState>(
    () => createInitialState(url)
  );

  useEffect(() => {
    let active = true;
    let historyStarted = false;

    const controller = new AbortController();

    const marketId = new URL(url)
      .searchParams.get("marketId");

    setState(createInitialState(url));

    function updateState(
      update: (previous: StreamState) => StreamState
    ): void {
      if (!active) {
        return;
      }

      setState((previous) => {
        if (!active || previous.url !== url) {
          return previous;
        }

        return update(previous);
      });
    }

    async function loadHistory(): Promise<void> {
      if (historyStarted) {
        return;
      }

      historyStarted = true;

      updateState((previous) => ({
        ...previous,
        historyStatus: "loading",
        historyError: null
      }));

      try {
        if (!marketId) {
          throw new Error(
            "marketId fehlt in der WebSocket-URL"
          );
        }

        await loadCandleHistory({
          marketId,
          signal: controller.signal,

          onPage: (candles) => {
            updateState((previous) => ({
              ...previous,

              // Bereits empfangene Daten haben Vorrang.
              candles: mergeCandles(
                candles,
                previous.candles
              )
            }));
          }
        });

        if (controller.signal.aborted) {
          return;
        }

        updateState((previous) => ({
          ...previous,
          historyStatus: "ready"
        }));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        updateState((previous) => ({
          ...previous,
          historyStatus: "error",
          historyError:
            error instanceof Error
              ? error.message
              : "Market history could not be loaded"
        }));
      }
    }

    function handleMessage(
      message: ServerMessage
    ): void {
      if (!active) {
        return;
      }

      switch (message.type) {
        case "CONNECTED":
          updateState((previous) => ({
            ...previous,
            connectionStatus: "connected"
          }));
          break;

        case "SNAPSHOT":
          updateState((previous) => ({
            ...previous,
            candles: mergeCandles(
              message.candles,
              previous.candles
            )
          }));

          void loadHistory();
          break;

        case "CURRENT_CANDLE":
          if (message.candle.marketId !== marketId) {
            return;
          }

          updateState((previous) => ({
            ...previous,
            currentCandle: message.candle
          }));
          break;

        case "CANDLE_COMPLETED":
          if (message.candle.marketId !== marketId) {
            return;
          }

          updateState((previous) => ({
            ...previous,

            candles: mergeCandles(
              previous.candles,
              [message.candle]
            ),

            currentCandle:
              previous.currentCandle &&
              previous.currentCandle.startTime >
                message.candle.startTime
                ? previous.currentCandle
                : null
          }));
          break;
      }
    }

    const socket = createOrderFlowSocket(
      url,
      handleMessage
    );

    function handleClose(): void {
      updateState((previous) => ({
        ...previous,
        connectionStatus: "disconnected"
      }));
    }

    socket.addEventListener("close", handleClose);

    // Auch bei ruhenden Märkten alte Candles entfernen.
    const cleanupTimer = window.setInterval(() => {
      updateState((previous) => {
        const cutoff = Date.now() - RETENTION_MS;

        const candles = previous.candles.filter(
          (candle) => candle.endTime > cutoff
        );

        if (candles.length === previous.candles.length) {
          return previous;
        }

        return {
          ...previous,
          candles
        };
      });
    }, 60_000);

    return () => {
      active = false;
      controller.abort();

      window.clearInterval(cleanupTimer);

      socket.removeEventListener(
        "close",
        handleClose
      );

      socket.close(
        1000,
        "Market changed or unmounted"
      );
    };
  }, [url]);

  // Alte Marktdaten bereits beim ersten Render
  // nach einem URL-Wechsel ausblenden.
  const visibleState =
    state.url === url
      ? state
      : createInitialState(url);

  return {
    connectionStatus: visibleState.connectionStatus,
    historyStatus: visibleState.historyStatus,
    historyError: visibleState.historyError,
    candles: visibleState.candles,
    currentCandle: visibleState.currentCandle
  };
}