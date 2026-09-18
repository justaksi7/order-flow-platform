import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi
} from "lightweight-charts";

import type {
  RectangleDrawing
} from "./ChartDrawing.js";

import {
  DrawingPaneRenderer
} from "./DrawingPaneRenderer.js";

export class DrawingPaneView
  implements IPrimitivePaneView {
  private readonly paneRenderer =
    new DrawingPaneRenderer();

  private readonly chart: IChartApi;

private readonly series:
  ISeriesApi<"Candlestick">;

public constructor(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">
) {
  this.chart = chart;
  this.series = series;
}

  public update(
    rectangles:
      readonly RectangleDrawing[],
    selectedDrawingId: string | null
  ): void {
    const coordinates = [];

    for (const rectangle of rectangles) {
      const startX =
        this.chart
          .timeScale()
          .timeToCoordinate(
            rectangle.start.time
          );

      const endX =
        this.chart
          .timeScale()
          .timeToCoordinate(
            rectangle.end.time
          );

      const startY =
        this.series.priceToCoordinate(
          rectangle.start.price
        );

      const endY =
        this.series.priceToCoordinate(
          rectangle.end.price
        );

      if (
        startX === null ||
        endX === null ||
        startY === null ||
        endY === null
      ) {
        continue;
      }

      coordinates.push({
        id: rectangle.id,
        startX: Number(startX),
        startY: Number(startY),
        endX: Number(endX),
        endY: Number(endY),
        borderColor:
          rectangle.borderColor,
        backgroundColor:
          rectangle.backgroundColor,
        selected:
          rectangle.id ===
          selectedDrawingId
      });
    }

    this.paneRenderer.update(
      coordinates
    );
  }

  public renderer():
    IPrimitivePaneRenderer {
    return this.paneRenderer;
  }

  public zOrder(): "top" {
    return "top";
  }
}