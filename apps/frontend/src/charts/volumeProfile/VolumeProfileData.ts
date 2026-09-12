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
};

export function createVolumeProfileData(
  candles:
    readonly SerializedFootprintCandle[]
): VolumeProfileData | null {
  if (candles.length === 0) {
    return null;
  }

  const footprintCandles =
    candles.map(
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
      analysis.valueAreaLow
  };
}