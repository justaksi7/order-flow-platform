import type { Market } from "@orderflow/domain";
import WebSocket, { type RawData } from "ws";
import type { MarketDataProvider, TradeHandler } from "../../MarketDataProvider.js";
import { mapBitgetTrade } from "./BitgetTradeMapper.js";
import type { BitgetEventMessage, BitgetSubscriptionArg, BitgetTradeMessage } from "./types.js";

const DEFAULT_URL = "wss://ws.bitget.com/v3/ws/public";
const HEARTBEAT_INTERVAL_MS = 30_000;

interface Subscription {
  readonly market: Market;
  readonly handler: TradeHandler;
}

export class BitgetMarketDataProvider implements MarketDataProvider {
  private socket: WebSocket | undefined;
  private heartbeat: NodeJS.Timeout | undefined;
  private readonly subscriptions = new Map<string, Subscription>();

  public constructor(private readonly url = DEFAULT_URL) { }

  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      const rejectConnection = (error: Error): void => reject(error);
      socket.once("error", rejectConnection);

      socket.once("open", () => {
        socket.off("error", rejectConnection);
        socket.on("error", (error) => console.error("[Bitget] WebSocket error:", error.message));
        socket.on("close", (code, reason) => this.handleClose(code, reason.toString()));
        socket.on("message", (raw) => this.handleMessage(raw));
        this.startHeartbeat();
        resolve();
      });
    });
  }

  public async disconnect(): Promise<void> {
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
    if (text === "pong") return;

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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.send("ping");
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    console.log(`[Bitget] disconnected (${code}${reason ? `: ${reason}` : ""})`);
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
