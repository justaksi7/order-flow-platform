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

const MARKETS = [
  { id: "bitget-btc-usdt", label: "BTC / USDT" },
  { id: "bitget-eth-usdt", label: "ETH / USDT" },
  { id: "bitget-xau-usdt", label: "XAU / USDT" }
] as const;

function App() {
  const [selectedMarketId, setSelectedMarketId] =
    useState<string>("bitget-btc-usdt");

  const socketUrl = useMemo(() => {
    const url = new URL(WEB_SOCKET_URL);

    url.searchParams.set(
      "marketId",
      selectedMarketId
    );

    return url.toString();
  }, [selectedMarketId]);

  const {
    connectionStatus,
    historyStatus,
    historyError,
    candles,
    currentCandle
  } = useOrderFlowSocket(socketUrl);

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

      <div className="market-selector">
        {MARKETS.map((market) => (
          <button
            key={market.id}
            type="button"
            aria-pressed={
              selectedMarketId === market.id
            }
            onClick={() =>
              setSelectedMarketId(market.id)
            }
          >
            {market.label}
          </button>
        ))}
      </div>

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

      {historyStatus === "waiting" && (
        <p role="status">
          {connectionStatus === "disconnected"
            ? "Verbindung getrennt. Bitte die Seite neu laden."
            : "Verbindung wird aufgebaut …"}
        </p>
      )}

      {historyStatus === "loading" && (
        <p role="status">
          Historie wird geladen: {candles.length} Candles …
        </p>
      )}

      {historyStatus === "error" && (
        <p role="alert">
          {historyError}. Die angezeigte Historie ist
          möglicherweise unvollständig. Bitte die Seite
          zum erneuten Laden aktualisieren.
        </p>
      )}

      {(
        historyStatus === "ready" ||
        historyStatus === "error"
      ) && (
          <PriceChart
            key={selectedMarketId}
            candles={displayedData.candles}
            currentCandle={displayedData.currentCandle}
            displayMode={displayMode}
          />
        )}
    </main>
  );
}

export default App;