import type {
  FootprintCandle,
  FootprintLevel,
  VolumeProfile,
  VolumeProfileLevel
} from "./types.js";

export function calculateVolumeProfile(
  candles: readonly FootprintCandle[]
): ReadonlyMap<number, FootprintLevel> {
  const profile = new Map<number, FootprintLevel>();
  for (const candle of candles) {
    for (const level of candle.levels.values()) {
      const existing = profile.get(level.price);
      profile.set(level.price, existing
        ? {
            price: level.price,
            bidVolume: existing.bidVolume + level.bidVolume,
            askVolume: existing.askVolume + level.askVolume,
            tradeCount: existing.tradeCount + level.tradeCount
          }
        : level);
    }
  }
  return profile;
}

export function getPointOfControl(
  profile: ReadonlyMap<number, FootprintLevel>
): FootprintLevel | undefined {
  let pointOfControl: FootprintLevel | undefined;
  let highestVolume = -Infinity;
  for (const level of profile.values()) {
    const volume = level.bidVolume + level.askVolume;
    if (volume > highestVolume) {
      highestVolume = volume;
      pointOfControl = level;
    }
  }
  return pointOfControl;
}

export function calculateProfileDelta(
  profile: ReadonlyMap<number, FootprintLevel>
): number {
  let delta = 0;
  for (const level of profile.values()) {
    delta += level.askVolume - level.bidVolume;
  }
  return delta;
}

export function getLevelVolume(level: FootprintLevel): number {
  return level.bidVolume + level.askVolume;
}

export function getProfileVolume(
  profile: ReadonlyMap<number, FootprintLevel>
): number {
  let volume = 0;
  for (const level of profile.values()) volume += getLevelVolume(level);
  return volume;
}

export interface ValueArea {
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly pointOfControl: number;
  readonly includedVolume: number;
  readonly targetVolume: number;
}

export function calculateValueArea(
  profile: ReadonlyMap<number, FootprintLevel>,
  valueAreaPercentage = 0.7
): ValueArea | undefined {
  if (valueAreaPercentage <= 0 || valueAreaPercentage > 1) {
    throw new Error("Value area percentage must be greater than 0 and at most 1");
  }
  if (profile.size === 0) return undefined;
  const pointOfControl = getPointOfControl(profile);
  if (!pointOfControl) return undefined;
  const levels = [...profile.values()].sort((a, b) => a.price - b.price);
  const pocIndex = levels.findIndex((level) => level.price === pointOfControl.price);
  if (pocIndex < 0) throw new Error("Point of Control is missing from profile");
  const targetVolume = getProfileVolume(profile) * valueAreaPercentage;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let includedVolume = getLevelVolume(pointOfControl);
  while (
    includedVolume < targetVolume &&
    (lowIndex > 0 || highIndex < levels.length - 1)
  ) {
    const lower = levels[lowIndex - 1];
    const upper = levels[highIndex + 1];
    const lowerVolume = lower ? getLevelVolume(lower) : -Infinity;
    const upperVolume = upper ? getLevelVolume(upper) : -Infinity;
    if (upperVolume >= lowerVolume) {
      highIndex++;
      includedVolume += upperVolume;
    } else {
      lowIndex--;
      includedVolume += lowerVolume;
    }
  }
  const low = levels[lowIndex];
  const high = levels[highIndex];
  if (!low || !high) throw new Error("Could not determine value area boundaries");
  return {
    valueAreaHigh: high.price,
    valueAreaLow: low.price,
    pointOfControl: pointOfControl.price,
    includedVolume,
    targetVolume
  };
}

export interface VolumeProfileAnalysis {
  readonly levels: ReadonlyMap<number, FootprintLevel>;
  readonly totalVolume: number;
  readonly delta: number;
  readonly pointOfControl: FootprintLevel;
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly includedValueAreaVolume: number;
  readonly targetValueAreaVolume: number;
}

export function analyzeVolumeProfile(
  candles: readonly FootprintCandle[],
  valueAreaPercentage = 0.7
): VolumeProfileAnalysis | undefined {
  const levels = calculateVolumeProfile(candles);
  if (levels.size === 0) return undefined;
  const pointOfControl = getPointOfControl(levels);
  const valueArea = calculateValueArea(levels, valueAreaPercentage);
  if (!pointOfControl || !valueArea) return undefined;
  return {
    levels,
    totalVolume: getProfileVolume(levels),
    delta: calculateProfileDelta(levels),
    pointOfControl,
    valueAreaHigh: valueArea.valueAreaHigh,
    valueAreaLow: valueArea.valueAreaLow,
    includedValueAreaVolume: valueArea.includedVolume,
    targetValueAreaVolume: valueArea.targetVolume
  };
}

export function createVolumeProfile(
  candle: FootprintCandle
): VolumeProfile {
  const levels =
    new Map<number, VolumeProfileLevel>();

  for (
    const level of candle.levels.values()
  ) {
    levels.set(level.price, {
      ...level,
      volume: getLevelVolume(level),
      delta:
        level.askVolume -
        level.bidVolume
    });
  }

  if (levels.size === 0) {
    throw new Error(
      "Cannot create a volume profile without levels"
    );
  }

  const pointOfControl =
    getPointOfControl(levels);

  const valueArea =
    calculateValueArea(levels);

  if (
    !pointOfControl ||
    !valueArea
  ) {
    throw new Error(
      "Could not analyze volume profile"
    );
  }

  return {
    levels,
    pocPrice: pointOfControl.price,
    valueAreaLow:
      valueArea.valueAreaLow,
    valueAreaHigh:
      valueArea.valueAreaHigh,
    totalVolume:
      getProfileVolume(levels)
  };
}
