import type { FootprintCandle, VolumeProfile, VolumeProfileLevel } from "./types.js";

export function createVolumeProfile(candle: FootprintCandle): VolumeProfile {
  if (candle.levels.size === 0) {
    throw new Error("Cannot create a volume profile without levels");
  }
  const levels = new Map<number, VolumeProfileLevel>();
  for (const level of candle.levels.values()) {
    levels.set(level.price, {
      ...level,
      volume: level.bidVolume + level.askVolume,
      delta: level.askVolume - level.bidVolume
    });
  }
  const sorted = [...levels.values()].sort((a, b) => b.volume - a.volume);
  const poc = sorted[0];
  if (!poc) throw new Error("Cannot create a volume profile without levels");
  const totalVolume = sorted.reduce((sum, level) => sum + level.volume, 0);
  const target = totalVolume * 0.7;
  let accumulated = 0;
  const valueArea = [...levels.values()].sort((a, b) => a.price - b.price);
  const included = new Set<number>();
  for (const level of sorted) {
    if (accumulated >= target) break;
    included.add(level.price);
    accumulated += level.volume;
  }
  const areaPrices = valueArea.filter((level) => included.has(level.price)).map((level) => level.price);
  return {
    levels,
    pocPrice: poc.price,
    valueAreaLow: Math.min(...areaPrices),
    valueAreaHigh: Math.max(...areaPrices),
    totalVolume
  };
}

export const calculateVolumeProfile = createVolumeProfile;

export function getPoc(profile: VolumeProfile): number {
  return profile.pocPrice;
}

export function getValueArea(profile: VolumeProfile): {
  readonly low: number;
  readonly high: number;
} {
  return { low: profile.valueAreaLow, high: profile.valueAreaHigh };
}
