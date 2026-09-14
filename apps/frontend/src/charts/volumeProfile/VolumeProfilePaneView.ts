import type {
  IPrimitivePaneView,
  ISeriesApi
} from "lightweight-charts";

import type {
  VolumeProfileData
} from "./VolumeProfileData";

import {
  VolumeProfileRenderer
} from "./VolumeProfileRenderer";

import type {
  VolumeProfileLevelRenderData
} from "./VolumeProfileRenderer";

export class VolumeProfilePaneView
  implements IPrimitivePaneView {
  private readonly paneRenderer =
    new VolumeProfileRenderer();
  private readonly series: ISeriesApi<"Candlestick">;

  public constructor(
    series: ISeriesApi<"Candlestick">
  ) {
    this.series = series;
  }

  public update(
    profile:
      VolumeProfileData | null
  ): void {
    if (!profile) {
      this.paneRenderer.update([]);
      return;
    }

    const renderLevels:
      VolumeProfileLevelRenderData[] = [];

    for (const level of profile.levels) {
      const upperPrice =
        level.price +
        profile.priceStep / 2;

      const lowerPrice =
        level.price -
        profile.priceStep / 2;

      const upperY =
        this.series.priceToCoordinate(
          upperPrice
        );

      const lowerY =
        this.series.priceToCoordinate(
          lowerPrice
        );

      if (
        upperY === null ||
        lowerY === null
      ) {
        continue;
      }

      const totalVolume =
        level.totalVolume;

      renderLevels.push({
        bidVolume: level.bidVolume,

        askVolume: level.askVolume,
        
        top: Math.min(
          upperY,
          lowerY
        ),

        height: Math.max(
          1,
          Math.abs(lowerY - upperY)
        ),

        volumeRatio:
          totalVolume /
          profile.maximumLevelVolume,

        bidRatio:
          totalVolume > 0
            ? level.bidVolume /
            totalVolume
            : 0,

        askRatio:
          totalVolume > 0
            ? level.askVolume /
            totalVolume
            : 0,

        isPointOfControl:
          level.price ===
          profile.pointOfControlPrice,

        isInsideValueArea:
          level.price >=
          profile.valueAreaLow &&
          level.price <=
          profile.valueAreaHigh
      });
    }

    this.paneRenderer.update(
      renderLevels
    );
  }

  public renderer():
    VolumeProfileRenderer {
    return this.paneRenderer;
  }

  public zOrder(): "top" {
    return "top";
  }
}