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
} from "./FootprintSeriesData";

import {
  FootprintSeriesRenderer
} from "./FootprintSeriesRenderer";

export type FootprintSeriesOptions =
  CustomSeriesOptions;

const DEFAULT_OPTIONS:
  FootprintSeriesOptions = {
    ...customSeriesDefaultOptions,
    lastValueVisible: false,
    priceLineVisible: false
  };

export class FootprintSeries
  implements
    ICustomSeriesPaneView<
      Time,
      FootprintSeriesData,
      FootprintSeriesOptions
    > {
  private readonly footprintRenderer =
    new FootprintSeriesRenderer();

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
    FootprintSeriesRenderer {
    return this.footprintRenderer;
  }

  public update(
    data: PaneRendererCustomData<
      Time,
      FootprintSeriesData
    >,
    _options: FootprintSeriesOptions
  ): void {
    this.footprintRenderer.update(data);
  }

  public defaultOptions():
    FootprintSeriesOptions {
    return DEFAULT_OPTIONS;
  }
}