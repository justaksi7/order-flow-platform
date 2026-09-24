# TickWeave Frontend

The frontend is a React 19 and Vite application for viewing live Bitget order flow. It connects to the backend WebSocket for current and completed candles, loads older candles through the REST history API, and renders the result with Lightweight Charts.

The complete platform reference is available at [../../docs/PROJECT_DOCUMENTATION.md](../../docs/PROJECT_DOCUMENTATION.md).

## Development

From the repository root:

```bash
npm install
npm run dev --workspace=@orderflow/frontend
```

Build and preview the production bundle:

```bash
npm run build --workspace=@orderflow/frontend
npm run preview --workspace=@orderflow/frontend
```

Run the frontend lint configuration:

```bash
npm run lint --workspace=@orderflow/frontend
```

The development server needs a running backend for live market data. The backend listens on port `8080` by default.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Static TickWeave home page and product preview |
| `/order-flow` | Live market and order-flow chart workspace |

There is no explicit not-found route.

## Data Flow

1. `createOrderFlowSocket` opens `/ws?marketId=<market>`.
2. `useOrderFlowSocket` receives `CONNECTED`, `SNAPSHOT`, `CURRENT_CANDLE`, and `CANDLE_COMPLETED` messages.
3. After the snapshot arrives, `loadCandleHistory` paginates backward through `/api/markets/:marketId/candles`.
4. Snapshot, REST, and live candles are merged by `startTime`; newer values replace older copies.
5. The client retains the same 48-hour window as the backend.
6. Larger timeframes are aggregated from one-minute footprint candles in the browser.

`VITE_WEBSOCKET_URL` can override the WebSocket URL at build time. Without it, the application derives a URL from the current page protocol and host.

## Chart Features

The order-flow page supports:

- Normal candlesticks, custom footprint cells, and candle volume profiles.
- Bid/ask intensity, level values, POC and value-area markers.
- Diagonal and stacked imbalance markers.
- Volume, delta histogram, cumulative delta, and VWAP panes.
- Sydney, Tokyo, London, and New York session profiles.
- Horizontal price lines and rectangle drawings.
- Market selection and all domain timeframes: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `12h`, and `1d`.

Chart drawings are held in React state and are not persisted. Non-normal display modes require additional horizontal bar spacing so footprint cells remain readable.

## Source Areas

```text
src/
  api/                       REST history loading
  charts/                    Lightweight Charts series and primitives
    candleVolumeProfile/     Per-candle volume-profile renderer
    cumulativeDelta/         Delta histogram and CVD conversion
    drawings/                Interactive chart drawings
    footprint/               Custom footprint series and renderer
    volume/                  Volume conversion
    volumeProfile/           Session-profile calculation and renderer
    vwap/                    VWAP conversion
  components/                Chart controls, layout, selectors, and status UI
  hooks/                     Live order-flow stream state
  pages/                     Home and order-flow routes
  websocket/                 Browser WebSocket construction
```

## Current Limitations

- The frontend does not automatically reconnect a closed WebSocket.
- Connection state is tracked by the stream hook but the static header indicators do not yet reflect it accurately.
- Market definitions are duplicated from the backend registry.
- The home page preview is static and is not connected to live data.
- The current VWAP series accumulates from the first available candle instead of resetting independently for each session.
- No frontend test suite is configured.