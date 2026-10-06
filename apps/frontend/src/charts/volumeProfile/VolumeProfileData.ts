import {
  analyzeVolumeProfile,
  deserializeFootprintCandle
} from "@orderflow/domain";

import type {
  SerializedFootprintCandle
} from "@orderflow/domain";

export type VolumeProfileLevelData = {
  readonly price: number;
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly totalVolume: number;
};

export type VolumeProfileData = {
  readonly levels:
  readonly VolumeProfileLevelData[];

  readonly maximumLevelVolume: number;
  readonly totalVolume: number;
  readonly delta: number;
  readonly pointOfControlPrice: number;
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly priceStep: number;
};

export function createVolumeProfileData(
  candles:
    readonly SerializedFootprintCandle[]
): VolumeProfileData | null {
  const usableCandles = candles.filter((candle) => candle.levels.some(
    (level) => level.bidVolume + level.askVolume > 0
  ));
  if (usableCandles.length === 0) {
    return null;
  }

  const priceStepCounts = new Map<number, number>();
  for (const candle of usableCandles) {
    priceStepCounts.set(
      candle.priceStep,
      (priceStepCounts.get(candle.priceStep) ?? 0) + 1
    );
  }

  const priceStep = [...priceStepCounts.entries()]
    .sort((first, second) => second[1] - first[1])[0]?.[0];

  if (priceStep === undefined) {
    return null;
  }

  const consistentCandles = usableCandles.filter(
    (candle) => candle.priceStep === priceStep
  );

  const footprintCandles =
    consistentCandles.map(
      deserializeFootprintCandle
    );

  const analysis =
    analyzeVolumeProfile(
      footprintCandles
    );

  if (!analysis) {
    return null;
  }

  const levels =
    [...analysis.levels.values()]
      .map((level) => ({
        price: level.price,
        bidVolume: level.bidVolume,
        askVolume: level.askVolume,
        totalVolume:
          level.bidVolume +
          level.askVolume
      }))
      .sort(
        (first, second) =>
          first.price - second.price
      );

  const maximumLevelVolume =
    Math.max(
      Number.EPSILON,
      ...levels.map(
        (level) =>
          level.totalVolume
      )
    );

  const firstCandle =
    footprintCandles[0];

  if (!firstCandle) {
    return null;
  }

  return {
    levels,
    maximumLevelVolume,
    totalVolume:
      analysis.totalVolume,
    delta:
      analysis.delta,
    pointOfControlPrice:
      analysis.pointOfControl.price,
    valueAreaHigh:
      analysis.valueAreaHigh,
    valueAreaLow:
      analysis.valueAreaLow,
    priceStep:
      firstCandle.priceStep
  };
}