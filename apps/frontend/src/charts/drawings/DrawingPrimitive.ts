import type {
  IChartApi,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time
} from "lightweight-charts";

import type {
  RectangleDrawing
} from "./ChartDrawing.js";

import {
  DrawingPaneView
} from "./DrawingPaneView.js";

export class DrawingPrimitive
  implements ISeriesPrimitive<Time> {
  private readonly paneView:
    DrawingPaneView;

  private rectangles:
    readonly RectangleDrawing[] = [];

  private selectedDrawingId:
    string | null = null;

  private requestUpdate:
    (() => void) | undefined;

  public constructor(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">
  ) {
    this.paneView =
      new DrawingPaneView(
        chart,
        series
      );
  }

  public attached(
    parameter:
      SeriesAttachedParameter<Time>
  ): void {
    this.requestUpdate =
      parameter.requestUpdate;
  }

  public detached(): void {
    this.requestUpdate = undefined;
  }

  public updateAllViews(): void {
    this.paneView.update(
      this.rectangles,
      this.selectedDrawingId
    );
  }

  public paneViews():
    readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  public setData(
    rectangles:
      readonly RectangleDrawing[],
    selectedDrawingId: string | null
  ): void {
    this.rectangles = rectangles;
    this.selectedDrawingId =
      selectedDrawingId;

    this.paneView.update(
      rectangles,
      selectedDrawingId
    );

    this.requestUpdate?.();
  }
}