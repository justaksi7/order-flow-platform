import "./App.css";

import {
  useState,
  useMemo
} from "react";

import type {
  OrderFlowDisplayMode
} from "./charts/OrderFlowDisplayMode";

import {
  useOrderFlowSocket
} from "./hooks/useOrderFlowSocket";

import {
  PriceChart
} from "./components/PriceChart";

import {
  aggregateByTimeFrame,
  deserializeFootprintCandle,
  getCandleStartTime,
  serializeAnalyzedFootprintCandle
} from "@orderflow/domain";

import type {
  TimeFrame
} from "@orderflow/domain";

const WEB_SOCKET_URL =
  import.meta.env.VITE_WEBSOCKET_URL ??
  "ws://localhost:8080";

const TIME_FRAMES:
  readonly TimeFrame[] = [
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "8h",
    "12h",
    "1d"
  ];

function App() {
  const {
    connectionStatus,
    candles,
    currentCandle,

  } = useOrderFlowSocket(WEB_SOCKET_URL);

  const [
    displayMode,
    setDisplayMode
  ] = useState<OrderFlowDisplayMode>(
    "NORMAL"
  );

  const [
    selectedTimeFrame,
    setSelectedTimeFrame
  ] = useState<TimeFrame>("1m");

  const displayedData = useMemo(() => {
    const serializedSourceCandles =
      currentCandle
        ? [
          ...candles.filter(
            (candle) =>
              candle.startTime !==
              currentCandle.startTime
          ),
          currentCandle
        ]
        : candles;

    if (
      serializedSourceCandles.length === 0
    ) {
      return {
        candles: [],
        currentCandle: null
      };
    }

    const domainCandles =
      serializedSourceCandles.map(
        deserializeFootprintCandle
      );

    const aggregatedCandles =
      aggregateByTimeFrame(
        domainCandles,
        selectedTimeFrame
      );

    const serializedCandles =
      aggregatedCandles.map(
        serializeAnalyzedFootprintCandle
      );

    if (!currentCandle) {
      return {
        candles: serializedCandles,
        currentCandle: null
      };
    }

    const currentGroupStartTime =
      getCandleStartTime(
        currentCandle.startTime,
        selectedTimeFrame
      );

    const aggregatedCurrentCandle =
      serializedCandles.find(
        (candle) =>
          candle.startTime ===
          currentGroupStartTime
      ) ?? null;

    return {
      candles: serializedCandles.filter(
        (candle) =>
          candle.startTime !==
          currentGroupStartTime
      ),

      currentCandle:
        aggregatedCurrentCandle
    };
  }, [
    candles,
    currentCandle,
    selectedTimeFrame
  ]);

  return (
    <main>
      <h1>Order Flow Analysis</h1>

      <section>
        <h2>WebSocket</h2>

        <p>
          Status: <strong>{connectionStatus}</strong>
        </p>
        <p>
          Gespeicherte Candles:{" "}
          <strong>{candles.length}</strong>
        </p>
      </section>

      <div className="time-frame-selector">
        {TIME_FRAMES.map((timeFrame) => (
          <button
            key={timeFrame}
            type="button"
            aria-pressed={
              selectedTimeFrame ===
              timeFrame
            }
            onClick={() =>
              setSelectedTimeFrame(
                timeFrame
              )
            }
          >
            {timeFrame}
          </button>
        ))}
      </div>

      <div className="chart-mode-selector">
        <button
          type="button"
          aria-pressed={
            displayMode === "NORMAL"
          }
          onClick={() =>
            setDisplayMode("NORMAL")
          }
        >
          Normal
        </button>

        <button
          type="button"
          aria-pressed={
            displayMode === "FOOTPRINT"
          }
          onClick={() =>
            setDisplayMode("FOOTPRINT")
          }
        >
          Footprint
        </button>

        <button
          type="button"
          aria-pressed={
            displayMode ===
            "CANDLE_VOLUME_PROFILE"
          }
          onClick={() =>
            setDisplayMode(
              "CANDLE_VOLUME_PROFILE"
            )
          }
        >
          Candle Volume Profile
        </button>
      </div>

      <PriceChart
        candles={displayedData.candles}
        currentCandle={
          displayedData.currentCandle
        }
        displayMode={displayMode}
      />
    </main>
  );
}

export default App;