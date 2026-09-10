import "./App.css";

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
    currentCandle
  } = useOrderFlowSocket(WEB_SOCKET_URL);

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
      <PriceChart
        candles={candles}
        currentCandle={currentCandle}
      />
    </main>
  );
}

export default App;