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
- [Analytics and Logging](#analytics-and-logging)
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

The trading interface is read-only: it does not submit orders or use authenticated exchange APIs. Completed candle buffers are persisted to per-market JSON files. The backend attempts to recover missing trades through Bitget's public REST API and rebuilds candles from the available trades. It also stores aggregate usage statistics in SQLite.

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
        |      +--> per-market JSON persistence / startup restore
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

On provider connection or reconnection, the backend requests missed public trades over REST, merges them with queued live trades, and broadcasts refreshed snapshots. Separately, Express middleware and a React page-view tracker update SQLite daily usage aggregates; the protected admin API reads those totals.

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
  ANALYTICS.md             Separate analytics operations guide (German)
```

### Package responsibilities

#### `packages/domain`

Defines `Market`, `Trade`, `Candle`, `FootprintCandle`, volume-profile, cumulative-delta, imbalance, and serialization types. It contains candle builders, aggregation logic, volume-profile analysis, imbalance analysis, and the in-memory candle buffer. Nothing in this package depends on Bitget.

#### `packages/markets`

Owns the static market registry and market lookup used by the backend. Market metadata is currently checked into source code rather than fetched from an exchange instrument endpoint.

#### `packages/market-data`

Defines the `MarketDataProvider` contract and implements `BitgetMarketDataProvider`. Exchange-specific wire types and mapping remain under `providers/bitget`.

#### `packages/protocol`

Defines the discriminated union of server messages exchanged with browser clients: `CONNECTED`, `MARKET_DATA_STATUS`, `SNAPSHOT`, `CURRENT_CANDLE`, and `CANDLE_COMPLETED`.

#### `apps/backend`

Creates one runtime per configured market, connects the provider, feeds trades into domain builders, persists completed candles, and exposes HTTP/WebSocket services on port `8080`. `src/analytics` owns SQLite counters, `src/logging` owns structured error logs and retention, and `tests/analytics.test.mjs` exercises analytics and logging behavior.

#### `apps/frontend`

Provides the user interface, market and timeframe controls, live stream hook, chart series, order-flow renderers, indicators, session profiles, and drawings.

## Getting Started

### Prerequisites

- Node.js 22.13 or newer; use a current patch release compatible with the dependency engine requirements
- npm 10 or newer
- Network access to Bitget's public WebSocket and REST API for live data and recovery

The repository includes `.nvmrc` with Node 22. The backend uses built-in `node:sqlite`, which is experimental in Node 22.

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

Vite prints the local frontend URL and proxies `/api` and `/ws` to `localhost:8080`. Set `VITE_WEBSOCKET_URL` when the WebSocket backend is at a different address. REST history and page-view requests still use same-origin `/api` URLs and need a matching proxy. In a proxied deployment, the frontend derives `/ws` from the current page protocol and host.

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
| `CANDLE_DATA_DIRECTORY` | Backend | `data/markets` | Directory for per-market completed-candle JSON files, relative to the process working directory |
| `ANALYTICS_DB_PATH` | Backend | `./data/analytics.sqlite` | SQLite daily aggregate database; Compose uses `/app/data/analytics.sqlite` |
| `ANALYTICS_ADMIN_TOKEN` | Backend / Compose | unset | Random token of at least 32 characters; Compose requires a nonempty value, and the backend rejects an unset or shorter token with `503` |
| `ERROR_LOG_DIR` | Backend | unset | Structured error files; unset sends errors to stderr. Compose uses `/app/data/errors` |
| `VITE_WEBSOCKET_URL` | Frontend build | derived from page URL | Optional complete WebSocket URL override |

The backend port is currently fixed at `8080`; there is no `PORT` setting. Provider URL, candle retention, snapshot size, and broadcast interval are source-level constants.

Direct `npm start` and `npm run dev` read the process environment; they do not automatically load the root `.env`. Compose interpolates values from its environment and `.env`. Frontend `VITE_` settings are build-time inputs and must never contain admin tokens. The checked-in production Compose file has fixed image tags; `TICKWEAVE_VERSION` applies only to a separately configured deployment using that variable.

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

The backend uses runtime footprint steps of `50` for BTC and `5` for ETH and XAU. These aggregation steps are separate from the registry display tick sizes.

### Candle aggregation

The frontend receives one-minute candles and aggregates them into larger supported timeframes when requested. Aggregation validates market identity, source timeframe, price-step consistency, chronological ordering, and target bucket containment. The target timeframe must be an integer multiple of the source timeframe. OHLCV, trade count, and level bid/ask volumes are summed or selected according to normal candle semantics.

### Imbalances

The default imbalance ratio is `3`. Buy diagonal imbalance compares ask volume at a level with bid volume at the lower price level. Sell diagonal imbalance compares bid volume at a level with ask volume at the upper price level. A zero comparison volume is represented as a valid imbalance with a `null` ratio. Stacked imbalances require consecutive levels and default to three levels.

### Volume profiles

Profiles combine footprint levels across one or more candles. The Point of Control is the level with the highest total volume (`bidVolume + askVolume`). The default value area targets 70% of total volume, expands outward from the POC, and chooses the higher-volume adjacent level first; ties favor the upper level.

### Retention and serialization

`FootprintCandleBuffer` keeps a sorted, replaceable, in-memory history for 48 hours. Adding a candle with an existing `startTime` replaces it. History pages default to 200 candles and allow 1 to 500 candles. The `before` cursor is exclusive and uses candle start time in milliseconds.

Maps are converted to sorted arrays for JSON transport. Deserialization rejects duplicate price levels. Serialized candles include computed footprint analysis.

Completed buffers are saved asynchronously as `<marketId>.json` using a temporary file followed by rename; writes are serialized per market. Startup loads these files into the retained in-memory buffer. The active candle is not persisted, and pending writes are not explicitly drained on shutdown. Candle retention filters in-memory history; disk files are refreshed on completed-candle saves rather than by a standalone deletion job.

## Market Data Ingestion

`BitgetMarketDataProvider` connects to:

```text
wss://ws.bitget.com/v3/ws/public
```

It subscribes to Bitget's `usdt-futures` / `publicTrade` channel and maps the exchange fields `i`, `p`, `v`, `S`, and `T` to the normalized `Trade` type. Incoming message batches are sorted by timestamp before handlers receive them. One handler is maintained per subscribed symbol.

The provider sends a `ping` every 30 seconds and uses `pong` responses to track liveness. A heartbeat timeout after 90 seconds terminates the connection. Unexpected closes trigger exponential reconnect delays starting at one second and capped at 30 seconds, followed by resubscription. An initial connection failure is handled by backend startup failure and shutdown rather than this reconnect loop.

Recovery uses `https://api.bitget.com/api/v2/mix/market/fills`, pages of up to 100 trades, and an `idLessThan` cursor. It deduplicates trade IDs and stops when it reaches the requested timestamp, exhausted history, or a repeated page. Exchange history availability limits the recoverable interval; full 48-hour reconstruction is not guaranteed.

The provider rejects non-finite price, quantity, or timestamp values and performs basic message-shape checks rather than complete schema validation. Provider errors are routed to the backend's structured error logger as fixed codes.

## Backend Runtime

The backend creates a runtime for each configured market containing:

- The registry `Market` definition.
- A one-minute `FootprintCandleBuilder`.
- A 48-hour `FootprintCandleBuffer`.
- The current active candle.
- The timestamp of the last current-candle broadcast.
- The last processed trade timestamp, recovery state, and queued live trades.

HTTP and WebSocket servers start before the provider connects. The provider then subscribes to every configured market. Completed candles are added to the relevant buffer and broadcast immediately. Active candles are broadcast at most every 250 milliseconds, while a candle transition is sent immediately.

Before HTTP startup, persisted candle buffers are restored. On provider connection/reconnection, recovery starts from the last known timestamp or, for an empty buffer, the 48-hour retention cutoff. Live trades are queued while recovery runs and merged with recovered trades in timestamp order; duplicate IDs are removed within that recovery batch. Refreshed snapshots and current candles are broadcast after processing each market. Recovery failures emit a fixed error code and a disconnected provider status; the current code has no dedicated recovery retry job.

The backend logs completed buffer sizes and lifecycle events to the console. Detailed candle/level-table printing exists but its call is disabled. `SIGINT` and `SIGTERM` stop the provider and close HTTP and WebSocket servers. SQLite closes on process exit.

## HTTP API

### Health check

```http
GET /api/health
```

Response:

```json
{"status":"ok"}
```

The response is `200` and includes `Cache-Control: no-store`. It checks HTTP availability, not exchange connectivity or recovery completion. Express responses also include a randomly generated `X-Request-ID`.

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
| `400` | `INVALID_LIMIT` | A supplied `limit` is non-integer or outside 1-500 |
| `400` | `INVALID_CURSOR` | `before` is not a non-negative integer |
| `404` | `UNKNOWN_MARKET` | No runtime exists for the requested market |
| `500` | `HISTORY_FAILED` | An unexpected history read failure occurred |

Only completed candles are returned by this endpoint.

### Record a page view

```http
POST /api/analytics/pageview
Content-Type: application/json

{"page":"/order-flow"}
```

The JSON body must contain only `page`, with one of `/`, `/order-flow`, or `/education`. The parser limit is 256 bytes. Successful recording returns `204`; invalid input or JSON returns `400`; a storage failure returns `503`. The endpoint does not authenticate visitors. Its public counters can be inflated by bots or fabricated events.

### Read daily statistics

```http
GET /api/admin/stats?date=2026-10-07
Authorization: Bearer <ANALYTICS_ADMIN_TOKEN>
```

`date` is optional and defaults to today in `Europe/Berlin`. It must be a real calendar date in `YYYY-MM-DD` format. A date with no stored data returns empty totals, including dates outside retention.

Example response with illustrative counts:

```json
{
  "date": "2026-10-07",
  "timezone": "Europe/Berlin",
  "pageviews": 180,
  "pages": [
    {"page": "/", "views": 120},
    {"page": "/order-flow", "views": 60}
  ],
  "requests": [
    {
      "method": "GET",
      "route": "/api/markets/:marketId/candles",
      "status": 200,
      "count": 420,
      "averageDurationMs": 18
    }
  ],
  "websocketConnections": 75
}
```

| Status | Meaning |
| ---: | --- |
| `200` | Daily summary returned |
| `400` | Invalid date (`INVALID_DATE`) |
| `401` | Missing or incorrect Bearer authorization |
| `503` | Admin token unset/shorter than 32 characters, or database read failure |

The backend compares SHA-256 digests of the supplied authorization and expected Bearer value using a timing-safe comparison. Use HTTPS for external access. No admin dashboard or user-account system is implemented. The statistics endpoint sends `Cache-Control: no-store`.

## Analytics and Logging

### Collected aggregates

SQLite stores rows keyed by Berlin calendar day, event kind, normalized route/page, method, and status. Each row contains a count and accumulated duration. No raw per-request event stream is retained.

- React reports allowlisted page paths on pathname changes, without analytics cookies, browser-storage identifiers, or referrers. Query/hash changes are not separate page views. A ref prevents duplicate effects for the same pathname, including React Strict Mode's effect replay.
- Express records completed HTTP responses with method, normalized route, status, and duration. The candle route is `/api/markets/:marketId/candles`; unknown paths use `unmatched` and unusual methods use `OTHER`.
- `/api/health`, `/api/analytics/pageview`, and `/api/admin/stats` matched routes are excluded from request statistics. Nginx responses, static assets, and rejected requests that never reach Express are not counted.
- Accepted WebSocket connections increment `/ws` totals after market validation. Reconnects count again; rejected markets do not. WebSocket messages and payloads are not recorded.

The analytics database contains no IP addresses, user IDs, tokens, headers, query strings, or request bodies. `pageviews` and `websocketConnections` are counts of events, not distinct people. Bot traffic, dropped frontend requests, and fabricated events affect accuracy.

### Storage and retention

Daily aggregates retain today plus the preceding 89 Berlin calendar days. Cleanup runs at startup and hourly. SQLite uses WAL and secure deletion; cleanup checkpoints and truncates the WAL. Writes are synchronous, so this implementation is intended for a single backend instance at modest traffic levels.

Application errors use JSON entries containing `level`, an ISO timestamp, a fixed `code`, and optionally a randomly generated `requestId`. Unfiltered Error objects and request contents are not passed to the server-side logger. Typical codes include `HISTORY_FAILED`, `ANALYTICS_WRITE_FAILED`, `BITGET_RECONNECT_FAILED`, and `CANDLE_PERSISTENCE_FAILED`.

With `ERROR_LOG_DIR` set, files are named `errors-YYYY-MM-DD.jsonl` and retained for today plus the preceding six UTC calendar days. Cleanup runs at startup, on error writes, and hourly. Without this setting, errors go to stderr and require an external retention policy. Lifecycle/buffer-size messages still go to stdout. Compose uses Docker's `local` logging driver with `10m` / `3` size rotation, which does not guarantee time-based expiry.

Cleanup jobs do not run while the application is stopped. Existing logs, proxy/CDN logs, backups, and exported copies need their own deletion policies. The server necessarily processes connection IPs even though analytics does not persist them. The analytics design alone does not establish GDPR compliance or consent exemption; deployment-specific legal basis, disclosures, access controls, and hosting agreements still need review.

The frontend currently loads Google Fonts from Google domains. Host fonts locally to remove these external requests. The theme preference uses local storage independently of analytics; no analytics identifier is stored there. The separate [analytics guide](ANALYTICS.md) is currently in German; this section documents the implemented behavior in English.

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

Provider lifecycle updates use:

```json
{"type":"MARKET_DATA_STATUS","marketId":"bitget-btc-usdt","status":"recovering"}
```

Statuses are `connecting`, `connected`, `disconnected`, `reconnecting`, and `recovering`. These updates are broadcast during provider lifecycle/recovery events; the initial connection sequence does not include a separate status snapshot. The server does not accept application commands from clients and has no explicit application-level inbound message-rate or payload-size configuration.

## Frontend

The Vite/React application defines three routes:

- `/`: TickWeave home page with a live BTC preview, using the active candle or latest completed candle.
- `/order-flow`: live order-flow workspace.
- `/education`: visual guide to chart displays, profiles, and indicators.

The order-flow page hard-codes the same three market IDs as the backend and supports all domain timeframes. It offers normal candlesticks, footprint cells, and per-candle volume profiles, plus VWAP, volume, cumulative delta, delta histogram, and session-profile controls for Sydney, Tokyo, London, and New York. Session calculations account for local timezone daylight-saving changes and can display today or yesterday.

`useOrderFlowSocket` opens one WebSocket for the selected market. After `SNAPSHOT`, it loads older REST pages until history is exhausted, merges snapshot, history, current, and completed data by candle start time, and keeps the same 48-hour retention window in the browser. Already received live data takes precedence over historical pages. Provider `connected` status updates trigger another history load. Failed history loading is displayed to the user; there is no automatic HTTP retry/backoff for throttled requests.

The chart is built on Lightweight Charts. Custom series and primitives render footprint cells, bid/ask intensity, POC borders, value-area lines, diagonal and stacked imbalance markers, session profiles, VWAP, volume, delta, CVD, and user drawings. Horizontal price lines and rectangles live only in React state; they are not persisted.

The workspace displays provider reconnect, recovery, disconnection, and history-loading/error banners. The shared header's "Markets online" label remains static. The home preview badge uses current-candle availability and provider status, rather than a complete end-to-end health check. There is no browser-side reconnect loop when the browser-to-backend WebSocket closes.

The light/dark theme follows the stored `tickweave-theme` preference or system preference and is persisted in local storage. `PageviewTracker` sends aggregate page-view events for the three allowlisted routes.

## Docker and Deployment

### Local Compose

Generate an admin token and create `.env` next to the Compose files before starting:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```dotenv
ANALYTICS_ADMIN_TOKEN=<your-generated-token>
```

```bash
docker compose -f compose.yml up --build
```

The local Compose stack builds both images. The frontend is available at `http://localhost:8081`; the backend remains internal to the Compose network. The frontend waits for the backend health check. Both services have size-limited Docker logs. The backend mounts `analytics-data` at `/app/data`, containing the SQLite database, error files, and default `data/markets` candle files because the image works in `/app`.

### Production Compose

```bash
docker compose -f compose.production.yml up -d
```

The production file consumes these GHCR images:

```text
ghcr.io/justaksi7/tickweave-backend:0.1.0
ghcr.io/justaksi7/tickweave-frontend:0.1.0
```

This checked-in production file publishes HTTP on port 80 and proxies `/api/` and `/ws` to the internal backend service. It requires the admin token and mounts the persistent volume, but has fixed image tags and no port 443, certificate mounts, or production Nginx mount. Rebuild/publish images containing the implementation before deploying; a tag alone does not ensure the image includes recent changes.

Nginx serves the React SPA with an `index.html` fallback and configures WebSocket upgrade headers. Both checked-in Nginx templates disable access logs and discard Nginx error logs to avoid storing client/request details. Discarding error logs reduces Nginx diagnostics. The checked-in templates do not include the separately proposed VPS rate limits, origin checks, CSP, or other security-header hardening.

### VPS HTTPS deployment

The separately managed VPS Compose configuration uses project name `tickweave`, images tagged with `${TICKWEAVE_VERSION}`, ports `80:80` and `443:443`, and these frontend mounts:

```yaml
volumes:
  - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
  - ./certbot/www:/var/www/certbot:ro
  - ./certbot/conf:/etc/letsencrypt:ro
```

Its `.env` needs both `TICKWEAVE_VERSION=<published-image-tag>` and `ANALYTICS_ADMIN_TOKEN=<generated-token>`. Keep the backend environment, `analytics-data:/app/data` volume, and logging settings from the repository Compose configuration. Running `.env` interpolation does not itself pass every variable into a container: the backend token is explicitly forwarded by `environment`.

`apps/frontend/nginx.production.conf` is a baseline HTTPS template for `tickweave.xyz` and `www.tickweave.xyz`, with an HTTP ACME challenge location and HTTPS redirect. It expects existing certificates under `/etc/letsencrypt/live/tickweave.xyz/`. The template does not provision or renew certificates. A mounted `./nginx/default.conf` overrides the image's bundled configuration.

When adapting the baseline, preserve an HTTP `/nginx-health` response for the image's Docker healthcheck: the checked-in HTTPS template only defines this endpoint in its TLS server, so its HTTP redirect does not provide a dependable healthcheck. The separately supplied hardened VPS configuration includes a loopback-only HTTP health location.

The proposed VPS hardening uses separate per-IP rates for the website (30/s), API (5/s), page views (30/min), admin statistics (10/min), and WebSocket handshakes (12/min), with bursts and a limit of 20 simultaneous WebSockets per IP. It also adds a shared backend request budget, connection limits, body/time limits, method restrictions, forwarding-header replacement, host/origin checks, and security headers. These are starting values for a direct Internet-to-Nginx deployment, not settings enabled by the checked-in files. Clients behind a shared public IP share the limits. A trusted CDN/reverse-proxy deployment requires an explicit client-IP trust configuration.

Handshake throttling does not limit WebSocket messages after upgrade. Origin checks do not authenticate CLI clients, and the admin Bearer token remains required. Validate the CSP against charts, inline styles, fonts, and WebSocket URLs; local font hosting allows removing Google domains from the policy. Test initial history pagination against the API limit, because the browser currently does not retry `429` responses.

For the VPS deployment, run commands from its Compose directory:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose exec frontend nginx -t
docker compose ps
```

For a configuration-only change to an already running container, run `nginx -t` before `docker compose exec frontend nginx -s reload`. Replacing a bind-mounted file by rename may require recreating the frontend container so the mount sees the new file. Verify healthchecks, charts, WebSockets, page views, and protected statistics after deployment. No production deployment or Nginx runtime validation is performed by updating this documentation.

### Persistence and image publication

Do not use `docker compose down -v` when retaining history/statistics: it deletes named volumes. Preserve the existing Compose project name on the VPS; changing it can select a different volume. Changing `CANDLE_DATA_DIRECTORY` to a path outside `/app/data` requires another suitable mount and write permissions for the `node` user. Use database-consistent backups for SQLite and apply the same retention/access rules to backup copies.

The backend uses a multi-stage Node 22.14 Alpine image, runs as the `node` user, prepares a writable `/app/data`, exposes port 8080, and checks `/api/health`. The frontend builds with Node 22 Alpine and serves static output from Nginx Alpine; its health check targets HTTP `/nginx-health`. Keep base images updated as part of deployment maintenance.

`.github/workflows/publish-images.yml` is a manual `workflow_dispatch` workflow. It accepts an image version, builds both Dockerfiles with Buildx, and publishes version and `latest` tags to GHCR. The workflow currently does not run tests, linting, or independent application build gates before publishing.

The Dockerfiles do compile their respective applications during image builds; this does not replace separate tests and lint checks.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run build` | Build root TypeScript project references |
| `npm run typecheck` | Run the root TypeScript build without pretty output |
| `node --test apps/backend/tests/analytics.test.mjs` | Run analytics/logging integration tests after the root build |
| `npm run clean` | Remove root TypeScript build artifacts |
| `npm run dev` | Start the backend development entry point |
| `npm start` | Start the compiled backend |
| `npm run dev --workspace=@orderflow/frontend` | Start the Vite frontend |
| `npm run build --workspace=@orderflow/frontend` | Build the frontend |
| `npm run lint --workspace=@orderflow/frontend` | Lint the frontend |
| `npm run preview --workspace=@orderflow/frontend` | Preview the frontend production build |

TypeScript uses strict mode, ES2023, NodeNext modules, declarations, source maps, project references, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

The backend analytics tests use Node's built-in test runner and import compiled `dist` modules. They cover Berlin day boundaries, admin access and date validation, page-view allowlisting, normalized request aggregates, database persistence, expired aggregate removal, error-log retention, and safe log fields. They do not validate market-data recovery, frontend behavior, or production Nginx configuration. Build before running them; no root `npm test` script is configured.

## Operational Behavior

- Data is public market data; no API key is required.
- Completed history is served from memory and restored from per-market JSON files on restart when the data directory is preserved. The active candle is not persisted.
- The backend keeps 48 hours of completed candles and the frontend removes stale candles even when the market is quiet.
- Startup/reconnect recovery attempts to rebuild history from available Bitget REST trades. It cannot guarantee full coverage, and empty time intervals are not synthesized.
- The provider keeps the connection alive with application-level ping messages.
- The provider reconnects with backoff and resubscribes. A browser-to-backend WebSocket close is surfaced internally but requires refresh or a new connection; there is no browser reconnect loop.
- Healthchecks indicate server responsiveness, not the completeness/freshness of exchange data.
- Analytics and application-error files use the persistent Compose volume and application-managed calendar-day retention. Docker stdout/stderr logs have size rotation only.
- REST and WebSocket payloads are TypeScript-typed at compile time but are not fully runtime-schema-validated.

## Known Limitations

1. Bitget is the only exchange and only public USDT futures are modeled.
2. Market metadata and footprint steps are hard-coded and are not checked against Bitget's instrument endpoint.
3. The browser WebSocket client has no reconnect loop. Initial provider connection failure shuts the backend down; subsequent unexpected closes use provider backoff.
4. Recovery is limited by exchange REST availability. Active candles and unflushed asynchronous writes may be lost on restart; full market history is not guaranteed.
5. The frontend duplicates market definitions instead of consuming a backend market metadata endpoint.
6. Recovery has no dedicated retry job after failure, and some recovery queue/error cases remain untested.
7. The shared header's "Markets online" label is static; the workspace's provider-status banners and home preview do not provide a complete end-to-end health check.
8. The VWAP series currently accumulates from the first available candle rather than resetting independently for each configured trading session.
9. Drawings are not persisted.
10. The manual image-publishing workflow has no tests, lint checks, or independent validation job; compilation runs inside the Docker builds.
11. Analytics counts events rather than unique people and accepts unauthenticated page-view submissions. Bots and fabricated events can affect totals.
12. SQLite counter writes and error-file writes are synchronous. This design targets a single backend instance; higher traffic or multiple instances needs a revised storage model.
13. The checked-in production deployment is HTTP-only and the HTTPS template lacks the HTTP healthcheck required by the frontend image. VPS hardening must be installed and validated separately.
14. There are no explicit backend inbound WebSocket payload/rate limits or browser retries for HTTP `429` responses.
15. Google Fonts are loaded externally. Log/backup deletion outside the application and privacy disclosures are deployment responsibilities.

## Potential Next Steps

The existing architecture leaves clear extension points for:

- Extend analytics tests with unit/integration coverage for mappers, candle builders, aggregation, recovery, profiles, and WebSocket sequencing.
- Recovery retries, bounded recovery queues, and stronger startup/reconnect resilience.
- Runtime loading and validation of Bitget instrument metadata.
- A shared market metadata package or endpoint to remove frontend/backend duplication.
- Stronger candle persistence guarantees and graceful draining of pending writes.
- Runtime schema validation for exchange messages and browser payloads.
- Accurate shared connection-status UI, browser reconnect behavior, and HTTP retry/backoff for throttled history requests.
- Session-reset VWAP calculation.
- CI validation before Docker image publication.
- Commit and validate production hardening, HTTP healthcheck support in the HTTPS template, and explicit inbound WebSocket limits.
- Local font hosting and consistent retention for backups and external logging systems.
- Additional providers behind the existing `MarketDataProvider` abstraction.
