# Orderflow Platform

Modularer TypeScript-Startpunkt für eine persönliche Order-Flow-Plattform. Der aktuelle Stand verbindet sich ohne API-Key mit dem öffentlichen Bitget-v3-WebSocket und normalisiert Live-Trades.

## Voraussetzungen

- Node.js 22 oder neuer
- npm 10 oder neuer

## Start

```bash
npm install
npm run build
npm start
```

Standardmäßig wird `BTCUSDT` abonniert. Für ETH:

```bash
MARKET_ID=bitget-eth-usdt npm start
```

Unter Windows PowerShell:

```powershell
$env:MARKET_ID = "bitget-eth-usdt"
npm start
```

## Module

- `packages/domain`: Exchange-neutrale Domain-Typen (`Market`, `Trade`)
- `packages/markets`: Zentrales Market-Registry
- `packages/market-data`: Provider-Interface und Bitget-Implementierung
- `apps/backend`: Aktueller Konsolen-Einstiegspunkt

Bitget-spezifische Nachrichten werden ausschließlich unter `packages/market-data/src/providers/bitget` verarbeitet. Alle nachgelagerten Module arbeiten mit dem normalisierten `Trade`-Interface.

## Nächster Meilenstein

1. Mapper und Provider testen
2. Reconnect mit Backoff ergänzen
3. `CandleBuilder` implementieren
4. Trades nach Preislevel zum Footprint aggregieren

Die Tick-Größen im Registry sind fürs erste MVP konfiguriert. Später sollen sie beim Start über Bitgets Instrument-Endpoint geladen und validiert werden.
