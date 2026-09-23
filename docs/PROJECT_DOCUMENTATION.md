# TickWeave Order-Flow Platform

TickWeave is a modular TypeScript platform for inspecting live market order flow. It connects to Bitget's public USDT-futures trade stream, normalizes exchange messages into an exchange-neutral domain model, builds one-minute footprint candles, and serves them to a React charting application over HTTP and WebSocket transports.

This document describes the current implementation, development workflow, runtime contracts, deployment model, and known limitations. The source code is the authority when implementation behavior differs from an example below.

## Contents

- [Product Scope](#product-scope)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Domain Model and Calculations](#domain-model-and-calculations)
- [Market Data Ingestion](#market-data-ingestion)
- [Backend Runtime](#backend-runtime)
- [HTTP API](#http-api)
- [WebSocket API](#websocket-api)
- [Frontend](#frontend)
- [Docker and Deployment](#docker-and-deployment)
- [Development Commands](#development-commands)
- [Operational Behavior](#operational-behavior)
- [Known Limitations](#known-limitations)
- [Potential Next Steps](#potential-next-steps)

## Product Scope

The platform currently supports public Bitget USDT-futures trade data for three configured markets:

| Market ID | Exchange symbol | Tick size | Display decimals |
| --- | --- | ---: | ---: |
| `bitget-btc-usdt` | `BTCUSDT` | `0.1` | price `1`, quantity `4` |
| `bitget-eth-usdt` | `ETHUSDT` | `0.01` | price `2`, quantity `3` |
| `bitget-xau-usdt` | `XAUUSDT` | `0.01` | price `2`, quantity `3` |

The backend subscribes to all three markets at startup. The selected market controls the default WebSocket stream and can be overridden with `MARKET_ID`; it does not currently limit provider subscriptions.

The application is read-only. It does not submit orders, use authenticated exchange APIs, persist data, or reconstruct missing candles.

## Architecture

```text
Bitget public WebSocket
        |
        v
BitgetMarketDataProvider
  - validates and maps messages
  - sorts trades by timestamp
        |
        v
FootprintCandleBuilder (one per market, 1m)
        |
        +--> FootprintCandleBuffer (48h in-memory history)
        |
        +--> HTTP history endpoint
        |
        +--> WebSocket snapshot/current/completed messages
                         |
                         v
                React frontend
                  - REST pagination
                  - live merge and retention
                  - client-side timeframe aggregation
                  - Lightweight Charts rendering
```

The repository is an npm workspace. Shared domain and protocol packages are compiled with TypeScript project references. The frontend is a separate Vite application and is built independently from the root TypeScript build.

## Repository Layout

```text
apps/
  backend/                 Node.js HTTP and WebSocket server
  frontend/                React/Vite trading interface
packages/
  domain/                  Exchange-neutral types and order-flow algorithms
  market-data/             Provider interface and Bitget implementation
  markets/                 Static market registry
  protocol/                Server-to-client WebSocket message types
docs/
  PROJECT_DOCUMENTATION.md This document
```

### Package responsibilities

#### `packages/domain`

Defines `Market`, `Trade`, `Candle`, `FootprintCandle`, volume-profile, cumulative-delta, imbalance, and serialization types. It contains candle builders, aggregation logic, volume-profile analysis, imbalance analysis, and the in-memory candle buffer. Nothing in this package depends on Bitget.

#### `packages/markets`

Owns the static market registry and market lookup used by the backend. Market metadata is currently checked into source code rather than fetched from an exchange instrument endpoint.

#### `packages/market-data`

Defines the `MarketDataProvider` contract and implements `BitgetMarketDataProvider`. Exchange-specific wire types and mapping remain under `providers/bitget`.

#### `packages/protocol`

Defines the discriminated union of server messages exchanged with browser clients: `CONNECTED`, `SNAPSHOT`, `CURRENT_CANDLE`, and `CANDLE_COMPLETED`.

#### `apps/backend`

Creates one runtime per configured market, connects the provider, feeds trades into domain builders, stores completed candles, and exposes HTTP/WebSocket services on port `8080`.

#### `apps/frontend`

Provides the user interface, market and timeframe controls, live stream hook, chart series, order-flow renderers, indicators, session profiles, and drawings.

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Network access to Bitget's public WebSocket for live data

The repository includes `.nvmrc` with Node 22.

### Install and build

```bash
npm install
npm run build
```

The root build compiles the backend-oriented TypeScript project references: domain, markets, market-data, protocol, and backend.

### Run the backend

```bash
npm start
```

The backend listens on `http://localhost:8080`. The default market is `bitget-btc-usdt`.

For development:

```bash
npm run dev
```

### Run the frontend

In a second terminal:

```bash
npm run dev --workspace=@orderflow/frontend
```

Vite prints the local frontend URL. Set `VITE_WEBSOCKET_URL` when the frontend must connect to a backend at a different address. In a proxied deployment, the frontend derives `/ws` from the current page protocol and host.

### Select the default market

On macOS/Linux:

```bash
MARKET_ID=bitget-eth-usdt npm start
```

On Windows PowerShell:

```powershell
$env:MARKET_ID = "bitget-eth-usdt"
npm start
```

Valid values are `bitget-btc-usdt`, `bitget-eth-usdt`, and `bitget-xau-usdt`.

## Configuration

| Variable | Component | Default | Description |
| --- | --- | --- | --- |
| `MARKET_ID` | Backend | `bitget-btc-usdt` | Default market for WebSocket clients and console selection |
| `VITE_WEBSOCKET_URL` | Frontend build | derived from page URL | Optional complete WebSocket URL override |

The backend port is currently fixed at `8080`; there is no `PORT` setting. Provider URL, candle retention, snapshot size, and broadcast interval are source-level constants.

## Domain Model and Calculations

### Time and candle boundaries

Supported timeframes are `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `12h`, and `1d`. Candle starts are calculated by flooring a Unix timestamp against the UTC epoch and the timeframe duration. Candle intervals are half-open: `[startTime, endTime)`.

`CandleBuilder` and `FootprintCandleBuilder` keep one active candle. A trade inside the active interval updates it. A trade in a later interval completes the previous candle and starts a new one. Missing intervals are not synthesized, and trades earlier than the current candle start are rejected.

### OHLCV and footprint levels

Each candle stores open, high, low, close, base volume, quote volume, and trade count. VWAP is calculated as:

```text
VWAP = quoteVolume / volume
```

Trade prices are rounded to the configured footprint `priceStep`. Each price level stores bid volume, ask volume, and trade count.

- `SELL` trades contribute quantity to bid volume.
- `BUY` trades contribute quantity to ask volume.
- Level delta is `askVolume - bidVolume`.
- Candle delta is the sum of all level deltas.

The backend uses runtime footprint steps of `100` for BTC and `10` for ETH and XAU. These aggregation steps are separate from the registry display tick sizes.

### Candle aggregation

The frontend receives one-minute candles and aggregates them into larger supported timeframes when requested. Aggregation validates market identity, source timeframe, price-step consistency, chronological ordering, and target bucket containment. The target timeframe must be an integer multiple of the source timeframe. OHLCV, trade count, and level bid/ask volumes are summed or selected according to normal candle semantics.

### Imbalances

The default imbalance ratio is `3`. Buy diagonal imbalance compares ask volume at a level with bid volume at the lower price level. Sell diagonal imbalance compares bid volume at a level with ask volume at the upper price level. A zero comparison volume is represented as a valid imbalance with a `null` ratio. Stacked imbalances require consecutive levels and default to three levels.

### Volume profiles

Profiles combine footprint levels across one or more candles. The Point of Control is the level with the highest total volume (`bidVolume + askVolume`). The default value area targets 70% of total volume, expands outward from the POC, and chooses the higher-volume adjacent level first; ties favor the upper level.

### Retention and serialization

`FootprintCandleBuffer` keeps a sorted, replaceable, in-memory history for 48 hours. Adding a candle with an existing `startTime` replaces it. History pages default to 200 candles and allow 1 to 500 candles. The `before` cursor is exclusive and uses candle start time in milliseconds.

Maps are converted to sorted arrays for JSON transport. Deserialization rejects duplicate price levels. Serialized candles include computed footprint analysis.

## Market Data Ingestion

`BitgetMarketDataProvider` connects to:

```text
wss://ws.bitget.com/v3/ws/public
```

It subscribes to Bitget's `usdt-futures` / `publicTrade` channel and maps the exchange fields `i`, `p`, `v`, `S`, and `T` to the normalized `Trade` type. Incoming message batches are sorted by timestamp before handlers receive them. One handler is maintained per subscribed symbol.

The provider sends a `ping` every 30 seconds and ignores `pong`. It logs provider events and errors and rejects non-finite price, quantity, or timestamp values. It performs basic message-shape checks but does not fully validate the Bitget schema.

## Backend Runtime

The backend creates a runtime for each configured market containing:

- The registry `Market` definition.
- A one-minute `FootprintCandleBuilder`.
- A 48-hour `FootprintCandleBuffer`.
- The current active candle.
- The timestamp of the last current-candle broadcast.

HTTP and WebSocket servers start before the provider connects. The provider then subscribes to every configured market. Completed candles are added to the relevant buffer and broadcast immediately. Active candles are broadcast at most every 250 milliseconds, while a candle transition is sent immediately.

The backend also prints current candle statistics and level tables to the console. `SIGINT` and `SIGTERM` stop the provider and close HTTP and WebSocket servers.

## HTTP API

### Health check

```http
GET /api/health
```

Response:

```json
{"status":"ok"}
```

The response is `200` and includes `Cache-Control: no-store`.

### Candle history

```http
GET /api/markets/{marketId}/candles?limit=200&before=1710000000000
```

Query parameters:

- `limit`: optional integer from 1 to 500; defaults to 200.
- `before`: optional non-negative integer Unix timestamp in milliseconds. The candle beginning at this value is excluded.

Response shape:

```json
{
  "marketId": "bitget-btc-usdt",
  "candles": [
    {
      "marketId": "bitget-btc-usdt",
      "timeFrame": "1m",
      "startTime": 1710000000000,
      "endTime": 1710000060000,
      "open": 70000,
      "high": 70020,
      "low": 69990,
      "close": 70010,
      "volume": 12.5,
      "quoteVolume": 875125,
      "tradeCount": 42,
      "priceStep": 100,
      "levels": [],
      "analysis": {
        "bidVolume": 6,
        "askVolume": 6.5,
        "delta": 0.5,
        "imbalances": [],
        "stackedImbalances": []
      }
    }
  ],
  "hasMore": false,
  "nextBefore": null
}
```

Errors use JSON objects with an `error` code and `message`:

| Status | Error | Cause |
| ---: | --- | --- |
| `400` | `INVALID_LIMIT` | `limit` is missing, non-integer, or outside 1-500 |
| `400` | `INVALID_CURSOR` | `before` is not a non-negative integer |
| `404` | `UNKNOWN_MARKET` | No runtime exists for the requested market |
| `500` | `HISTORY_FAILED` | An unexpected history read failure occurred |

Only completed candles are returned by this endpoint.

## WebSocket API

Connect to:

```text
ws://localhost:8080/ws?marketId=bitget-btc-usdt
```

`marketId` is optional. When omitted, the backend default from `MARKET_ID` is used. Unknown markets close with WebSocket code `1008`. During shutdown, clients close with code `1001`.

### Initial message sequence

After a valid connection, the server sends:

1. `CONNECTED` with a human-readable market message.
2. `SNAPSHOT` containing up to the latest 200 completed candles.
3. `CURRENT_CANDLE` when an active candle is available.

### Live messages

```json
{"type":"CONNECTED","message":"Connected to bitget-btc-usdt"}
```

```json
{"type":"SNAPSHOT","candles":[/* serialized analyzed candles */]}
```

```json
{"type":"CURRENT_CANDLE","candle":{/* serialized analyzed candle */}}
```

```json
{"type":"CANDLE_COMPLETED","candle":{/* serialized analyzed candle */}}
```

Broadcasts are isolated by market, so a client receives only the stream selected in its connection URL.

## Frontend

The Vite/React application defines two routes:

- `/`: static TickWeave home page with a non-live BTC preview.
- `/order-flow`: live order-flow workspace.

The order-flow page hard-codes the same three market IDs as the backend and supports all domain timeframes. It offers normal candlesticks, footprint cells, and per-candle volume profiles, plus VWAP, volume, cumulative delta, delta histogram, and session-profile controls for Sydney, Tokyo, London, and New York. Session calculations account for local timezone daylight-saving changes and can display today or yesterday.

`useOrderFlowSocket` opens one WebSocket for the selected market. After `SNAPSHOT`, it loads older REST pages until history is exhausted, merges snapshot, history, current, and completed data by candle start time, and keeps the same 48-hour retention window in the browser. Newer data takes precedence when the same candle is received through multiple paths.

The chart is built on Lightweight Charts. Custom series and primitives render footprint cells, bid/ask intensity, POC borders, value-area lines, diagonal and stacked imbalance markers, session profiles, VWAP, volume, delta, CVD, and user drawings. Horizontal price lines and rectangles live only in React state; they are not persisted.

The current frontend tracks connection state internally, but the static header indicators still display "Markets online" and "Live feed" regardless of the actual state. There is no browser-side reconnect loop.

## Docker and Deployment

### Local Compose

```bash
docker compose -f compose.yml up --build
```

The local Compose stack builds both images. The frontend is available at `http://localhost:8081`; the backend remains internal to the Compose network. The frontend waits for the backend health check.

### Production Compose

```bash
docker compose -f compose.production.yml up -d
```

The production file consumes these GHCR images:

```text
ghcr.io/justaksi7/tickweave-backend:0.1.0
ghcr.io/justaksi7/tickweave-frontend:0.1.0
```

The frontend is published on port 80 and proxies `/api/` and `/ws` to the internal backend service. Nginx serves the React SPA with an `index.html` fallback and configures WebSocket upgrade headers.

The backend uses a multi-stage Node 22 Alpine image, runs as the `node` user, exposes port 8080, and checks `/api/health`. The frontend builds with Node 22 Alpine and serves static output from Nginx Alpine; its health check targets `/nginx-health`.

`.github/workflows/publish-images.yml` is a manual `workflow_dispatch` workflow. It accepts an image version, builds both Dockerfiles with Buildx, and publishes version and `latest` tags to GHCR. The workflow currently does not run tests, linting, or independent application build gates before publishing.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run build` | Build root TypeScript project references |
| `npm run typecheck` | Run the root TypeScript build without pretty output |
| `npm run clean` | Remove root TypeScript build artifacts |
| `npm run dev` | Start the backend development entry point |
| `npm start` | Start the compiled backend |
| `npm run dev --workspace=@orderflow/frontend` | Start the Vite frontend |
| `npm run build --workspace=@orderflow/frontend` | Build the frontend |
| `npm run lint --workspace=@orderflow/frontend` | Lint the frontend |
| `npm run preview --workspace=@orderflow/frontend` | Preview the frontend production build |

TypeScript uses strict mode, ES2023, NodeNext modules, declarations, source maps, project references, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

There is currently no automated test suite or test-runner configuration in the repository.

## Operational Behavior

- Data is public market data; no API key is required.
- All runtime history is in memory and is lost when the backend restarts.
- The backend keeps 48 hours of completed candles and the frontend removes stale candles even when the market is quiet.
- The system does not fill gaps caused by missing trades, provider downtime, or startup time.
- The provider keeps the connection alive with application-level ping messages.
- A provider or browser WebSocket close is logged or surfaced as disconnected, but neither side automatically reconnects.
- REST and WebSocket payloads are TypeScript-typed at compile time but are not fully runtime-schema-validated.

## Known Limitations

1. Bitget is the only exchange and only public USDT futures are modeled.
2. Market metadata and footprint steps are hard-coded and are not checked against Bitget's instrument endpoint.
3. There is no automatic reconnect or exponential backoff for either WebSocket client.
4. In-memory retention means all history disappears on process restart.
5. The frontend duplicates market definitions instead of consuming a backend market metadata endpoint.
6. The home page preview is static and is not connected to the live stream.
7. The displayed connection indicators do not reflect the tracked live connection status.
8. The VWAP series currently accumulates from the first available candle rather than resetting independently for each configured trading session.
9. Drawings are not persisted.
10. The manual image-publishing workflow has no test, lint, or build gate.
11. The original project README and the frontend README were template-level documentation; this document is the project-level reference.

## Potential Next Steps

The existing architecture leaves clear extension points for:

- Unit and integration tests for mappers, candle builders, aggregation, profiles, APIs, and WebSocket sequencing.
- Provider reconnect and backoff with resubscription.
- Runtime loading and validation of Bitget instrument metadata.
- A shared market metadata package or endpoint to remove frontend/backend duplication.
- Durable storage for candle history.
- Runtime schema validation for exchange messages and browser payloads.
- Accurate connection-status UI and browser reconnect behavior.
- Session-reset VWAP calculation.
- CI validation before Docker image publication.
- Additional providers behind the existing `MarketDataProvider` abstraction.