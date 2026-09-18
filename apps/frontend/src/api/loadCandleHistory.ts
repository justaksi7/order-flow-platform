import type {
  SerializedAnalyzedFootprintCandle
} from "@orderflow/domain";

type Candle = SerializedAnalyzedFootprintCandle;

type HistoryPage = {
  readonly marketId: string;
  readonly candles: readonly Candle[];
  readonly hasMore: boolean;
  readonly nextBefore: number | null;
};

type LoadHistoryOptions = {
  readonly marketId: string;
  readonly signal: AbortSignal;
  readonly onPage: (
    candles: readonly Candle[]
  ) => void;
};

export async function loadCandleHistory({
  marketId,
  signal,
  onPage
}: LoadHistoryOptions): Promise<void> {
  let before: number | undefined;

  while (!signal.aborted) {
    const query = new URLSearchParams({
      limit: "200"
    });

    if (before !== undefined) {
      query.set("before", String(before));
    }

    const response = await fetch(
      `/api/markets/${encodeURIComponent(marketId)}` +
      `/candles?${query.toString()}`,
      {
        signal,
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Market history could not be loaded: HTTP ${response.status}`
      );
    }

    const page: HistoryPage = await response.json();

    if (
      page.marketId !== marketId ||
      !Array.isArray(page.candles) ||
      typeof page.hasMore !== "boolean" ||
      page.candles.some(
        (candle) => candle.marketId !== marketId
      )
    ) {
      throw new Error("Invalid market history response");
    }

    if (signal.aborted) {
      return;
    }

    onPage(page.candles);

    if (!page.hasMore) {
      return;
    }

    const cursor = page.nextBefore;

    if (
      typeof cursor !== "number" ||
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      page.candles.length === 0 ||
      cursor !== page.candles[0]?.startTime ||
      (before !== undefined && cursor >= before)
    ) {
      throw new Error("Invalid market history cursor");
    }

    before = cursor;
  }
}