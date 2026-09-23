# TickWeave Order-Flow Platform

Modular TypeScript platform for live Bitget order-flow analysis. The system normalizes public trades, builds one-minute footprint candles, streams them over HTTP and WebSocket, and renders them in a React/Lightweight Charts frontend.

## Quick Start

```bash
npm install
npm run build
npm start
```

The backend listens on port `8080` and defaults to `bitget-btc-usdt`. Start the frontend separately with:

```bash
npm run dev --workspace=@orderflow/frontend
```

To select another configured market:

```bash
MARKET_ID=bitget-eth-usdt npm start
```

PowerShell:

```powershell
$env:MARKET_ID = "bitget-eth-usdt"
npm start
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

The application currently uses public Bitget USDT-futures trades and requires no API key. Runtime candle history is in memory and retained for 48 hours.
