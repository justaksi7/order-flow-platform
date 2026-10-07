# TickWeave Order-Flow Platform

Modular TypeScript platform for live Bitget order-flow analysis. The system normalizes public trades, builds one-minute footprint candles, streams them over HTTP and WebSocket, and renders them in a React/Lightweight Charts frontend.

## Requirements

- Node.js 22.13 or newer; use a current patch release compatible with the project dependencies. The backend uses built-in `node:sqlite`, which is experimental in Node 22.
- npm 10 or newer.
- Access to Bitget's public WebSocket and REST endpoints for live data and recovery.

## Quick Start

```bash
npm install
npm run build
npm start
```

The backend listens on port `8080`, subscribes to BTC, ETH, and XAU USDT futures, and defaults to `bitget-btc-usdt`. Start the frontend in a second terminal:

```bash
npm run dev --workspace=@orderflow/frontend
```

Vite proxies `/api` and `/ws` to the backend. Open the URL printed by Vite. The application includes a live BTC home-page preview, an order-flow workspace, and an education page.

To select another default backend market:

```bash
MARKET_ID=bitget-eth-usdt npm start
```

PowerShell:

```powershell
$env:MARKET_ID = "bitget-eth-usdt"
npm start
```

## Analytics and Logging

The backend stores daily page-view, API-request, and accepted WebSocket-connection totals in SQLite. These are usage counts, not unique visitors. Analytics does not store IP addresses, visitor identifiers, query strings, headers, or request bodies.

- Day boundaries use `Europe/Berlin`; daily aggregates are retained for 90 calendar days.
- `GET /api/admin/stats?date=YYYY-MM-DD` requires `Authorization: Bearer <token>`.
- Set `ANALYTICS_ADMIN_TOKEN` to a random value of at least 32 characters. Without it, local analytics collection still works but the statistics endpoint returns `503`.
- Structured application errors use fixed event codes and optional random request IDs. Compose stores error files for seven UTC calendar days.

Generate an admin token with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For direct Node execution, explicitly set backend environment variables; `npm start` does not load `.env` automatically. Docker Compose reads `.env` next to the Compose file. Keep this file out of version control.

## Docker

Create a `.env` file in the repository root:

```dotenv
ANALYTICS_ADMIN_TOKEN=<your-generated-token>
```

Build and run locally:

```bash
docker compose -f compose.yml up --build
```

Open `http://localhost:8081`. The backend is internal to the Compose network. The `analytics-data` volume stores analytics, error files, and completed candle history at the default container paths.

The checked-in `compose.production.yml` uses GHCR images tagged `0.1.0` and publishes HTTP on port 80. It does not configure HTTPS or read `TICKWEAVE_VERSION`. A VPS deployment using version interpolation, port 443, and certificate/configuration mounts must configure those explicitly. See the [deployment reference](docs/PROJECT_DOCUMENTATION.md#docker-and-deployment) before deploying.

## Verification

```bash
npm run build
node --test apps/backend/tests/analytics.test.mjs
npm run build --workspace=@orderflow/frontend
npm run lint --workspace=@orderflow/frontend
```

## Documentation

See [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) for the complete project reference, including architecture, domain calculations, HTTP and WebSocket APIs, frontend behavior, Docker deployment, configuration, development commands, and known limitations.

## Main Modules

- `packages/domain`: exchange-neutral models and order-flow algorithms
- `packages/markets`: static market registry
- `packages/market-data`: provider abstraction and Bitget implementation
- `packages/protocol`: server WebSocket message contracts
- `apps/backend`: HTTP/WebSocket runtime and market-data orchestration
- `apps/frontend`: React order-flow interface and chart renderers

The application uses public Bitget USDT-futures trades and requires no exchange API key. It retains 48 hours of completed candles in memory, saves them as per-market JSON files, and restores retained history on startup. The provider reconnects with backoff and attempts to recover missed trades from the public REST API. Drawings remain in browser memory.

The bundled Nginx configurations disable access logs and discard Nginx error logs. Rate limits and security headers from the separately supplied VPS configuration are not included in these templates. Privacy obligations, external font requests, backup retention, and deployment limitations are covered in the [project reference](docs/PROJECT_DOCUMENTATION.md#analytics-and-logging). The separate [analytics operations guide](docs/ANALYTICS.md) is currently in German.
