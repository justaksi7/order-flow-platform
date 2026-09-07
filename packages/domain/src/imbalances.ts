import type { FootprintCandle, Imbalance, StackedImbalance } from "./types.js";

export interface ImbalanceOptions {
  readonly ratio?: number;
  readonly minimumVolume?: number;
}

export function calculateImbalances(
  candle: FootprintCandle,
  options: ImbalanceOptions = {}
): readonly Imbalance[] {
  const ratio = options.ratio ?? 3;
  const minimumVolume = options.minimumVolume ?? 0;
  const result: Imbalance[] = [];
  for (const level of candle.levels.values()) {
    const { bidVolume, askVolume } = level;
    if (askVolume >= minimumVolume && askVolume > bidVolume * ratio) {
      result.push({
        price: level.price,
        side: "ASK",
        ratio: bidVolume === 0 ? Number.POSITIVE_INFINITY : askVolume / bidVolume,
        dominantVolume: askVolume,
        opposingVolume: bidVolume
      });
    } else if (bidVolume >= minimumVolume && bidVolume > askVolume * ratio) {
      result.push({
        price: level.price,
        side: "BID",
        ratio: askVolume === 0 ? Number.POSITIVE_INFINITY : bidVolume / askVolume,
        dominantVolume: bidVolume,
        opposingVolume: askVolume
      });
    }
  }
  return result;
}

export const calculateDiagonalImbalances = calculateImbalances;

export function findStackedImbalances(
  imbalances: readonly Imbalance[],
  minimumStackSize = 3
): readonly StackedImbalance[] {
  const result: StackedImbalance[] = [];
  for (const side of ["BID", "ASK"] as const) {
    const sorted = imbalances
      .filter((imbalance) => imbalance.side === side)
      .sort((a, b) => a.price - b.price);
    let stack: Imbalance[] = [];
    for (const imbalance of sorted) {
      const previous = stack[stack.length - 1];
      if (previous && imbalance.price > previous.price) {
        stack.push(imbalance);
      } else {
        if (stack.length >= minimumStackSize) result.push({ side, imbalances: stack });
        stack = [imbalance];
      }
    }
    if (stack.length >= minimumStackSize) result.push({ side, imbalances: stack });
  }
  return result;
}

export const calculateStackedImbalances = findStackedImbalances;
