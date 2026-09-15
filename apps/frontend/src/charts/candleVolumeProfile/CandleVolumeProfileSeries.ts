import {
  customSeriesDefaultOptions
} from "lightweight-charts";

import type {
  CustomSeriesOptions,
  CustomSeriesPricePlotValues,
  ICustomSeriesPaneView,
  PaneRendererCustomData,
  Time,
  WhitespaceData
} from "lightweight-charts";

import type {
  FootprintSeriesData
} from "../footprint/FootprintSeriesData";

import {
  CandleVolumeProfileSeriesRenderer
} from "./CandleVolumeProfileSeriesRenderer";

export type CandleVolumeProfileSeriesOptions =
  CustomSeriesOptions;

const DEFAULT_OPTIONS:
  CandleVolumeProfileSeriesOptions = {
    ...customSeriesDefaultOptions,
    lastValueVisible: false,
    priceLineVisible: false
  };

export class CandleVolumeProfileSeries
  implements
    ICustomSeriesPaneView<
      Time,
      FootprintSeriesData,
      CandleVolumeProfileSeriesOptions
    > {
  private readonly profileRenderer =
    new CandleVolumeProfileSeriesRenderer();

  public priceValueBuilder(
    candle: FootprintSeriesData
  ): CustomSeriesPricePlotValues {
    if (candle.levels.length === 0) {
      return [Number.NaN];
    }

    let minimumLevelPrice =
      Number.POSITIVE_INFINITY;

    let maximumLevelPrice =
      Number.NEGATIVE_INFINITY;

    for (const level of candle.levels) {
      minimumLevelPrice = Math.min(
        minimumLevelPrice,
        level.price
      );

      maximumLevelPrice = Math.max(
        maximumLevelPrice,
        level.price
      );
    }

    return [
      minimumLevelPrice -
        candle.priceStep / 2,

      maximumLevelPrice +
        candle.priceStep / 2,

      candle.close
    ];
  }

  public isWhitespace(
    data:
      | FootprintSeriesData
      | WhitespaceData
  ): data is WhitespaceData {
    return (
      !("levels" in data) ||
      data.levels.length === 0
    );
  }

  public renderer():
    CandleVolumeProfileSeriesRenderer {
    return this.profileRenderer;
  }

  public update(
    data: PaneRendererCustomData<
      Time,
      FootprintSeriesData
    >,
    _options:
      CandleVolumeProfileSeriesOptions
  ): void {
    this.profileRenderer.update(data);
  }

  public defaultOptions():
    CandleVolumeProfileSeriesOptions {
    return DEFAULT_OPTIONS;
  }
}