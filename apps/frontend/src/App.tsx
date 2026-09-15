import "./App.css";

import {
  useState
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

const WEB_SOCKET_URL =
  import.meta.env.VITE_WEBSOCKET_URL ??
  "ws://localhost:8080";

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
        candles={candles}
        currentCandle={currentCandle}
        displayMode={displayMode}
      />
    </main>
  );
}

export default App;