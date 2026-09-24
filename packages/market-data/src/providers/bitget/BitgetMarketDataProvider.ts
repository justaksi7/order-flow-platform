import type { Market, Trade } from "@orderflow/domain";
import WebSocket, { type RawData } from "ws";
import type {
  MarketDataProvider,
  MarketDataStatus,
  TradeHandler
} from "../../MarketDataProvider.js";
import {
  mapBitgetRestTrade,
  mapBitgetTrade
} from "./BitgetTradeMapper.js";
import type {
  BitgetEventMessage,
  BitgetRestTradeData,
  BitgetSubscriptionArg,
  BitgetTradeData,
  BitgetTradeMessage
} from "./types.js";

const DEFAULT_URL = "wss://ws.bitget.com/v3/ws/public";
const DEFAULT_REST_URL = "https://api.bitget.com/api/v2/mix/market/fills";
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;
const TRADE_RECOVERY_PAGE_SIZE = 100;

interface Subscription {
  readonly market: Market;
  readonly handler: TradeHandler;
}

export class BitgetMarketDataProvider implements MarketDataProvider {
  private socket: WebSocket | undefined;
  private heartbeat: NodeJS.Timeout | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectAttempt = 0;
  private isDisconnectRequested = false;
  private lastPongAt = 0;
  private readonly subscriptions = new Map<string, Subscription>();

  public constructor(
    private readonly url = DEFAULT_URL,
    private readonly onStatus?: (status: MarketDataStatus) => void
  ) { }

  public connect(): Promise<void> {
    this.isDisconnectRequested = false;
    this.clearReconnectTimer();

    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      const rejectConnection = (error: Error): void => {
        socket.removeAllListeners();

        if (this.socket === socket) {
          this.socket = undefined;
        }

        reject(error);
      };
      socket.once("error", rejectConnection);

      socket.once("open", () => {
        socket.off("error", rejectConnection);
        socket.on("error", (error) => console.error("[Bitget] WebSocket error:", error.message));
        socket.on("close", (code, reason) => this.handleClose(code, reason.toString()));
        socket.on("message", (raw) => this.handleMessage(raw));
        this.startHeartbeat();
        this.reconnectAttempt = 0;
        this.onStatus?.("connected");

        for (const subscription of this.subscriptions.values()) {
          this.send("subscribe", subscription.market);
        }

        resolve();
      });
    });
  }

  public async disconnect(): Promise<void> {
    this.isDisconnectRequested = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = undefined;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close(1000, "Client shutdown");
    });
  }

  public async subscribeTrades(market: Market, handler: TradeHandler): Promise<void> {
    this.assertSupported(market);
    this.assertConnected();
    this.subscriptions.set(market.symbol, { market, handler });
    this.send("subscribe", market);
  }

  public async unsubscribeTrades(market: Market): Promise<void> {
    this.assertConnected();
    this.send("unsubscribe", market);
    this.subscriptions.delete(market.symbol);
  }

  public async fetchTradesSince(
    market: Market,
    since: number
  ): Promise<readonly Trade[]> {
    const recoveredTrades = new Map<string, Trade>();
    const seenPageTradeIds = new Set<string>();
    let idLessThan: string | undefined;

    while (true) {
      const query = new URLSearchParams({
        productType: "USDT-FUTURES",
        symbol: market.symbol,
        limit: String(TRADE_RECOVERY_PAGE_SIZE)
      });

      if (idLessThan !== undefined) {
        query.set("idLessThan", idLessThan);
      }

      const response = await fetch(
        `${DEFAULT_REST_URL}?${query.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          `Bitget trade recovery failed: HTTP ${response.status}`
        );
      }

      const payload: unknown = await response.json();

      if (!this.isTradeHistoryResponse(payload)) {
        throw new Error("Bitget trade recovery returned an invalid response");
      }

      const page = payload.data.map((data) => mapBitgetRestTrade(data, market));
      let hasRepeatedTrade = false;

      for (const trade of page) {
        if (seenPageTradeIds.has(trade.id)) {
          hasRepeatedTrade = true;
        }

        seenPageTradeIds.add(trade.id);

        if (trade.timestamp >= since) {
          recoveredTrades.set(trade.id, trade);
        }
      }

      if (hasRepeatedTrade) {
        break;
      }

      if (page.length < TRADE_RECOVERY_PAGE_SIZE) {
        break;
      }

      const firstTrade = page[0];

      if (!firstTrade) {
        break;
      }

      const oldestTrade = page.reduce(
        (oldest, trade) =>
          BigInt(trade.id) < BigInt(oldest.id)
            ? trade
            : oldest,
        firstTrade
      );

      if (oldestTrade.timestamp <= since) {
        break;
      }

      const nextIdLessThan = oldestTrade.id;

      if (idLessThan === nextIdLessThan) {
        throw new Error("Bitget trade recovery cursor did not advance");
      }

      idLessThan = nextIdLessThan;
    }

    return [...recoveredTrades.values()].sort(
      (first, second) => first.timestamp - second.timestamp
    );
  }

  private send(op: "subscribe" | "unsubscribe", market: Market): void {
    const arg: BitgetSubscriptionArg = {
      instType: "usdt-futures",
      topic: "publicTrade",
      symbol: market.symbol
    };
    this.socket?.send(JSON.stringify({ op, args: [arg] }));
  }

  private handleMessage(raw: RawData): void {
    const text = raw.toString();
    if (text === "pong") {
      this.lastPongAt = Date.now();
      return;
    }

    try {
      const message: unknown = JSON.parse(text);
      if (this.isEvent(message)) {
        if (message.event === "error") {
          console.error(`[Bitget] ${message.code ?? "error"}: ${message.msg ?? "Unknown error"}`);
        } else {
          console.log(`[Bitget] ${message.event}: ${message.arg?.symbol ?? "unknown"}`);
        }
        return;
      }

      if (!this.isTradeMessage(message)) return;
      const subscription = this.subscriptions.get(message.arg.symbol);
      if (!subscription) return;

      const trades = message.data
        .map((data) =>
          mapBitgetTrade(
            data,
            subscription.market
          )
        )
        .sort(
          (first, second) =>
            first.timestamp - second.timestamp
        );

      for (const trade of trades) {
        subscription.handler(trade);
      }
    } catch (error) {
      console.error("[Bitget] Could not process message:", error);
    }
  }

  private isEvent(value: unknown): value is BitgetEventMessage {
    return typeof value === "object" && value !== null && "event" in value;
  }

  private isTradeMessage(value: unknown): value is BitgetTradeMessage {
    return typeof value === "object" && value !== null && "arg" in value && "data" in value && Array.isArray(value.data);
  }

  private isTradeHistoryResponse(
    value: unknown
  ): value is { readonly data: readonly BitgetRestTradeData[] } {
    if (typeof value !== "object" || value === null || !("data" in value)) {
      return false;
    }

    const data = (value as { data?: unknown }).data;

    return Array.isArray(data) && data.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "tradeId" in item &&
        "price" in item &&
        "size" in item &&
        "side" in item &&
        "ts" in item
    );
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();
    this.heartbeat = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        console.error("[Bitget] Heartbeat timeout; reconnecting.");
        this.socket.terminate();
        return;
      }

      this.socket.send("ping");
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    console.log(`[Bitget] disconnected (${code}${reason ? `: ${reason}` : ""})`);

    if (this.isDisconnectRequested) {
      return;
    }

    this.socket = undefined;
    this.onStatus?.("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isDisconnectRequested || this.reconnectTimer) {
      return;
    }

    this.onStatus?.("reconnecting");

    const delay = Math.min(
      30_000,
      1_000 * 2 ** Math.min(this.reconnectAttempt, 5)
    );

    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;

      void this.connect().catch((error) => {
        console.error("[Bitget] Reconnect failed:", error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private assertConnected(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error("Bitget provider is not connected");
    }
  }

  private assertSupported(market: Market): void {
    if (market.exchange !== "BITGET" || market.productType !== "USDT_FUTURES") {
      throw new Error(`Unsupported market: ${market.id}`);
    }
  }
}
