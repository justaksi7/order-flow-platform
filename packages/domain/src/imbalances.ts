import { getPriceLevel } from "./candles.js";
import type {
  FootprintCandle,
  FootprintCandleAnalysis,
  FootprintImbalance,
  StackedImbalance
} from "./types.js";

export function isVolumeImbalance(
  dominantVolume: number,
  comparedVolume: number,
  minimumRatio = 3
): boolean {
  if (
    !Number.isFinite(dominantVolume) ||
    !Number.isFinite(comparedVolume) ||
    dominantVolume < 0 ||
    comparedVolume < 0
  ) {
    throw new Error("Volumes must be finite and non-negative");
  }
  if (!Number.isFinite(minimumRatio) || minimumRatio <= 1) {
    throw new Error("Minimum imbalance ratio must be greater than 1");
  }
  if (dominantVolume === 0) return false;
  if (comparedVolume === 0) return true;
  return dominantVolume / comparedVolume >= minimumRatio;
}

export function findDiagonalImbalances(
  candle: FootprintCandle,
  tickSize: number,
  minimumRatio = 3
): readonly FootprintImbalance[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new Error("Tick size must be finite and greater than 0");
  }
  const result: FootprintImbalance[] = [];
  for (const level of candle.levels.values()) {
    const lower = candle.levels.get(getPriceLevel(level.price - tickSize, tickSize));
    const upper = candle.levels.get(getPriceLevel(level.price + tickSize, tickSize));
    if (lower && isVolumeImbalance(level.askVolume, lower.bidVolume, minimumRatio)) {
      result.push({
        price: level.price,
        side: "BUY",
        dominantVolume: level.askVolume,
        comparedVolume: lower.bidVolume,
        ratio: lower.bidVolume === 0 ? Infinity : level.askVolume / lower.bidVolume
      });
    }
    if (upper && isVolumeImbalance(level.bidVolume, upper.askVolume, minimumRatio)) {
      result.push({
        price: level.price,
        side: "SELL",
        dominantVolume: level.bidVolume,
        comparedVolume: upper.askVolume,
        ratio: upper.askVolume === 0 ? Infinity : level.bidVolume / upper.askVolume
      });
    }
  }
  return result;
}

export function findStackedImbalances(
  imbalances: readonly FootprintImbalance[],
  tickSize: number,
  minimumLevels = 3
): readonly StackedImbalance[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new Error("Tick size must be finite and greater than 0");
  }
  if (!Number.isInteger(minimumLevels) || minimumLevels < 2) {
    throw new Error("Minimum levels must be an integer of at least 2");
  }
  const result: StackedImbalance[] = [];
  for (const side of ["BUY", "SELL"] as const) {
    const sorted = imbalances
      .filter((imbalance) => imbalance.side === side)
      .sort((a, b) => a.price - b.price);
    let stack: FootprintImbalance[] = [];
    const complete = (): void => {
      if (stack.length < minimumLevels) return;
      const first = stack[0];
      const last = stack[stack.length - 1];
      if (first && last) {
        result.push({
          side,
          lowPrice: first.price,
          highPrice: last.price,
          imbalances: [...stack]
        });
      }
    };
    for (const imbalance of sorted) {
      const previous = stack[stack.length - 1];
      const expected = previous
        ? getPriceLevel(previous.price + tickSize, tickSize)
        : undefined;
      if (previous && imbalance.price !== expected) {
        complete();
        stack = [imbalance];
      } else {
        stack.push(imbalance);
      }
    }
    complete();
  }
  return result;
}

export function analyzeFootprintCandle(
  candle: FootprintCandle,
  tickSize: number,
  minimumImbalanceRatio = 3,
  minimumStackedLevels = 3
): FootprintCandleAnalysis {
  let bidVolume = 0;
  let askVolume = 0;
  for (const level of candle.levels.values()) {
    bidVolume += level.bidVolume;
    askVolume += level.askVolume;
  }
  const imbalances = findDiagonalImbalances(candle, tickSize, minimumImbalanceRatio);
  return {
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    imbalances,
    stackedImbalances: findStackedImbalances(
      imbalances,
      tickSize,
      minimumStackedLevels
    )
  };
}
