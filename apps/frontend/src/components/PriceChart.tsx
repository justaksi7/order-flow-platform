import { useCallback, useEffect, useRef, useState } from "react";
import type { CandlestickData, IChartApi, IPriceLine, ISeriesApi, MouseEventParams, Time, UTCTimestamp, WhitespaceData } from "lightweight-charts";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, LineStyle } from "lightweight-charts";
import type { ServerMessage } from "@orderflow/protocol";
import { toDeltaHistogramSeriesData } from "../charts/cumulativeDelta/toDeltaHistogramSeriesData";
import { FootprintSeries } from "../charts/footprint/FootprintSeries";
import { toFootprintSeriesData } from "../charts/footprint/FootprintSeriesData";
import type { FootprintSeriesData } from "../charts/footprint/FootprintSeriesData";
import { toCumulativeDeltaSeriesData } from "../charts/cumulativeDelta/toCumulativeDeltaSeriesData";
import { toVolumeSeriesData } from "../charts/volume/toVolumeSeriesData";
import { createVolumeProfileData } from "../charts/volumeProfile/VolumeProfileData";
import { VolumeProfilePrimitive } from "../charts/volumeProfile/VolumeProfilePrimitive";
import { CandleVolumeProfileSeries } from "../charts/candleVolumeProfile/CandleVolumeProfileSeries";
import type { OrderFlowDisplayMode } from "../charts/OrderFlowDisplayMode";
import type { DrawingPoint, RectangleDrawing } from "../charts/drawings/ChartDrawing";
import { DrawingPrimitive } from "../charts/drawings/DrawingPrimitive";
import type { SessionVwapData } from "../charts/vwap/toSessionVwapData";
type SnapshotMessage = Extract<ServerMessage, {
  type: "SNAPSHOT";
}>;
type SerializedCandle = SnapshotMessage["candles"][number];
type DrawingTool = "CURSOR" | "HORIZONTAL_LINE" | "RECTANGLE";
type HorizontalLineDrawing = {
  readonly id: string;
  readonly price: number;
};
type PriceChartProps = {
  readonly candles: readonly SerializedCandle[];
  readonly currentCandle: SerializedCandle | null;
  readonly displayMode: OrderFlowDisplayMode;
  readonly vwapSessions: readonly SessionVwapData[];
  readonly showVwap: boolean;
};
function toCandlestickData(candle: SerializedCandle): CandlestickData<Time> {
  return {
    time: Math.floor(candle.startTime / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  };
}
export function PriceChart({ candles, currentCandle, displayMode, vwapSessions, showVwap }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const vwapSeriesRef = useRef(new Map<number, ISeriesApi<"Line">>());
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const cumulativeDeltaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const footprintSeriesRef = useRef<ISeriesApi<"Custom", Time, FootprintSeriesData | WhitespaceData<Time>> | null>(null);
  const candleVolumeProfileSeriesRef = useRef<ISeriesApi<"Custom", Time, FootprintSeriesData | WhitespaceData<Time>> | null>(null);
  const deltaHistogramSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const hasFittedContentRef = useRef(false);
  const volumeProfilePrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("CURSOR");
  const drawingToolRef = useRef<DrawingTool>("CURSOR");
  const [horizontalLines, setHorizontalLines] = useState<readonly HorizontalLineDrawing[]>([]);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const [rectangles, setRectangles] = useState<readonly RectangleDrawing[]>([]);
  const rectanglesRef = useRef<readonly RectangleDrawing[]>([]);
  const pendingRectangleStartRef = useRef<DrawingPoint | null>(null);
  const drawingPrimitiveRef = useRef<DrawingPrimitive | null>(null);
  const horizontalLinesRef = useRef<readonly HorizontalLineDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const selectedDrawingIdRef = useRef<string | null>(null);
  const selectDrawing = useCallback((id: string | null): void => {
    selectedDrawingIdRef.current = id;
    setSelectedDrawingId(id);
  }, []);
  const selectDrawingTool = useCallback((tool: DrawingTool): void => {
    if (tool !== "RECTANGLE") {
      pendingRectangleStartRef.current =
        null;
    }
    drawingToolRef.current = tool;
    setDrawingTool(tool);
  }, []);
  const removeSelectedDrawing = useCallback((): void => {
    const selectedId = selectedDrawingIdRef.current;
    if (!selectedId) {
      return;
    }
    setHorizontalLines((previousLines) => previousLines.filter((line) => line.id !== selectedId));
    setRectangles((previousRectangles) => previousRectangles.filter((rectangle) => rectangle.id !== selectedId));
    selectDrawing(null);
  }, [selectDrawing]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = createChart(container, {
      autoSize: true,
      height: 600,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#0f172a"
        },
        textColor: "#cbd5e1"
      },
      grid: {
        vertLines: {
          color: "#1e293b"
        },
        horzLines: {
          color: "#1e293b"
        }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false
      }
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444"
    });
    function handleChartClick(parameter: MouseEventParams<Time>): void {
      if (!parameter.point ||
        parameter.paneIndex !== 0) {
        return;
      }
      if (drawingToolRef.current === "HORIZONTAL_LINE") {
        const price = series.coordinateToPrice(parameter.point.y);
        if (price === null) {
          return;
        }
        const id = `horizontal-line-${Date.now()}-` +
          `${Math.random()
            .toString(16)
            .slice(2)}`;
        setHorizontalLines((previousLines) => [
          ...previousLines,
          {
            id,
            price: Number(price)
          }
        ]);
        selectDrawing(id);
        selectDrawingTool("CURSOR");
        return;
      }
      if (drawingToolRef.current === "RECTANGLE") {
        const time = chart.timeScale().coordinateToTime(parameter.point.x);
        const price = series.coordinateToPrice(parameter.point.y);
        if (time === null || price === null || !Number.isFinite(price))
          return;
        const point: DrawingPoint = { time, price: Number(price) };
        const start = pendingRectangleStartRef.current;
        if (!start) {
          pendingRectangleStartRef.current = point;
          selectDrawing(null);
          return;
        }
        const startX = chart.timeScale().timeToCoordinate(start.time);
        const endX = chart.timeScale().timeToCoordinate(point.time);
        // Ein Rechteck braucht eine sichtbare Breite und Höhe.
        if (startX === null || endX === null ||
          startX === endX || start.price === point.price)
          return;
        const id = "rectangle-" + Date.now() + "-" + Math.random().toString(16).slice(2);
        setRectangles((previous) => [...previous, {
          id,
          type: "RECTANGLE",
          start,
          end: point,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.14)"
        }]);
        selectDrawing(id);
        selectDrawingTool("CURSOR");
        return;
      }
      let closestId: string | null = null;
      let closestDistance = 6;
      for (const line of horizontalLinesRef.current) {
        const y = series.priceToCoordinate(line.price);
        if (y === null)
          continue;
        const distance = Math.abs(y - parameter.point.y);
        if (distance <= closestDistance) {
          closestDistance = distance;
          closestId = line.id;
        }
      }
      if (closestId !== null) {
        selectDrawing(closestId);
        return;
      }
      for (let index = rectanglesRef.current.length - 1; index >= 0; index -= 1) {
        const rectangle = rectanglesRef.current[index];
        if (!rectangle)
          continue;
        const x1 = chart.timeScale().timeToCoordinate(rectangle.start.time);
        const x2 = chart.timeScale().timeToCoordinate(rectangle.end.time);
        const y1 = series.priceToCoordinate(rectangle.start.price);
        const y2 = series.priceToCoordinate(rectangle.end.price);
        if (x1 === null || x2 === null || y1 === null || y2 === null)
          continue;
        if (parameter.point.x >= Math.min(x1, x2) &&
          parameter.point.x <= Math.max(x1, x2) &&
          parameter.point.y >= Math.min(y1, y2) &&
          parameter.point.y <= Math.max(y1, y2)) {
          selectDrawing(rectangle.id);
          return;
        }
      }
      selectDrawing(null);
    }
    chart.subscribeClick(handleChartClick);
    const volumeProfilePrimitive = new VolumeProfilePrimitive(series);
    series.attachPrimitive(volumeProfilePrimitive);
    const drawingPrimitive = new DrawingPrimitive(chart, series);
    series.attachPrimitive(drawingPrimitive);
    drawingPrimitiveRef.current = drawingPrimitive;
    const footprintSeries = chart.addCustomSeries(new FootprintSeries(), {
      visible: false
    });
    const candleVolumeProfileSeries = chart.addCustomSeries(new CandleVolumeProfileSeries(), {
      visible: false
    });
    const deltaHistogramSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "delta",
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
      title: "Delta"
    }, 1);
    deltaHistogramSeries
      .priceScale()
      .applyOptions({
        scaleMargins: {
          top: 0.65,
          bottom: 0.05
        }
      });
    const cumulativeDeltaSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: "CVD"
    }, 1);
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume"
      },
      priceLineVisible: false,
      lastValueVisible: true,
      title: "Volume"
    }, 2);
    const panes = chart.panes();
    const cumulativeDeltaPane = panes[1];
    const volumePane = panes[2];
    if (cumulativeDeltaPane) {
      cumulativeDeltaPane.setHeight(160);
    }
    if (volumePane) {
      volumePane.setHeight(110);
    }
    chartRef.current = chart;
    seriesRef.current = series;
    footprintSeriesRef.current = footprintSeries;
    candleVolumeProfileSeriesRef.current =
      candleVolumeProfileSeries;
    cumulativeDeltaSeriesRef.current =
      cumulativeDeltaSeries;
    deltaHistogramSeriesRef.current =
      deltaHistogramSeries;
    volumeSeriesRef.current =
      volumeSeries;
    volumeProfilePrimitiveRef.current =
      volumeProfilePrimitive;
    return () => {
      series.detachPrimitive(volumeProfilePrimitive);
      chart.unsubscribeClick(handleChartClick);
      priceLinesRef.current.clear();
      series.detachPrimitive(drawingPrimitive);
      drawingPrimitiveRef.current = null;
      pendingRectangleStartRef.current = null;
      chart.remove();
      vwapSeriesRef.current.clear();
      chartRef.current = null;
      seriesRef.current = null;
      footprintSeriesRef.current = null;
      candleVolumeProfileSeriesRef.current =
        null;
      hasFittedContentRef.current = false;
      cumulativeDeltaSeriesRef.current = null;
      deltaHistogramSeriesRef.current = null;
      volumeSeriesRef.current = null;
      volumeProfilePrimitiveRef.current =
        null;
    };
  }, [selectDrawing, selectDrawingTool]);
  useEffect(() => {
    horizontalLinesRef.current = horizontalLines;
  }, [horizontalLines]);
  useEffect(() => {
    rectanglesRef.current = rectangles;
    drawingPrimitiveRef.current?.setData(rectangles, selectedDrawingId);
  }, [rectangles, selectedDrawingId]);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest("input, textarea, select") !== null))
        return;
      if (event.key === "Escape") {
        selectDrawingTool("CURSOR");
        selectDrawing(null);
      }
      else if (event.key === "Delete" && selectedDrawingIdRef.current !== null) {
        event.preventDefault();
        removeSelectedDrawing();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeSelectedDrawing, selectDrawing, selectDrawingTool]);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) {
      return;
    }
    const priceLines = priceLinesRef.current;
    const activeIds = new Set(horizontalLines.map((line) => line.id));
    for (const line of horizontalLines) {
      const existing = priceLines.get(line.id);
      const isSelected = line.id === selectedDrawingId;
      if (existing) {
        existing.applyOptions({
          price: line.price,
          color: isSelected ? "#fde047" : "#f59e0b",
          lineWidth: isSelected ? 3 : 2
        });
        continue;
      }
      const priceLine = series.createPriceLine({
        price: line.price,
        color: isSelected ? "#fde047" : "#f59e0b",
        lineWidth: isSelected ? 3 : 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: ""
      });
      priceLines.set(line.id, priceLine);
    }
    for (const [id, priceLine] of priceLines) {
      if (activeIds.has(id)) {
        continue;
      }
      series.removePriceLine(priceLine);
      priceLines.delete(id);
    }
  }, [horizontalLines, selectedDrawingId]);
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const footprintSeries = footprintSeriesRef.current;
    const candleVolumeProfileSeries = candleVolumeProfileSeriesRef.current;
    if (!chart ||
      !series ||
      !footprintSeries ||
      !candleVolumeProfileSeries) {
      return;
    }
    const isNormal = displayMode === "NORMAL";
    const isFootprint = displayMode === "FOOTPRINT";
    const isCandleVolumeProfile = displayMode ===
      "CANDLE_VOLUME_PROFILE";
    const transparent = "rgba(0, 0, 0, 0)";
    series.applyOptions({
      visible: true,
      upColor: isNormal
        ? "#22c55e"
        : transparent,
      downColor: isNormal
        ? "#ef4444"
        : transparent,
      wickUpColor: isNormal
        ? "#22c55e"
        : transparent,
      wickDownColor: isNormal
        ? "#ef4444"
        : transparent
    });
    footprintSeries.applyOptions({
      visible: isFootprint
    });
    candleVolumeProfileSeries.applyOptions({
      visible: isCandleVolumeProfile
    });
    if (!isNormal) {
      const timeScale = chart.timeScale();
      const currentBarSpacing = timeScale.options().barSpacing;
      if (currentBarSpacing < 70) {
        timeScale.applyOptions({
          barSpacing: 70
        });
      }
    }
  }, [displayMode]);
  useEffect(() => {
    const series = seriesRef.current;
    const footprintSeries = footprintSeriesRef.current;
    const candleVolumeProfileSeries = candleVolumeProfileSeriesRef.current;
    if (!series ||
      !footprintSeries ||
      !candleVolumeProfileSeries) {
      return;
    }
    const chartData = candles.map(toCandlestickData);
    const footprintData = candles.map(toFootprintSeriesData);
    series.setData(chartData);
    footprintSeries.setData(footprintData);
    candleVolumeProfileSeries.setData(footprintData);
    if (chartData.length > 0 &&
      !hasFittedContentRef.current) {
      chartRef.current
        ?.timeScale()
        .fitContent();
      hasFittedContentRef.current = true;
    }
  }, [candles]);
  useEffect(() => {
    if (!currentCandle) {
      return;
    }
    const footprintData = toFootprintSeriesData(currentCandle);
    seriesRef.current?.update(toCandlestickData(currentCandle));
    footprintSeriesRef.current?.update(footprintData);
    candleVolumeProfileSeriesRef.current
      ?.update(footprintData);
  }, [currentCandle, candles]);
  useEffect(() => {
    const cumulativeDeltaSeries = cumulativeDeltaSeriesRef.current;
    const deltaHistogramSeries = deltaHistogramSeriesRef.current;
    if (!cumulativeDeltaSeries ||
      !deltaHistogramSeries) {
      return;
    }
    const sourceCandles = currentCandle
      ? [...candles, currentCandle]
      : candles;
    cumulativeDeltaSeries.setData(toCumulativeDeltaSeriesData(sourceCandles));
    deltaHistogramSeries.setData(toDeltaHistogramSeriesData(sourceCandles));
  }, [
    candles,
    currentCandle
  ]);
  useEffect(() => {
    const volumeSeries = volumeSeriesRef.current;
    if (!volumeSeries) {
      return;
    }
    const sourceCandles = currentCandle
      ? [...candles, currentCandle]
      : candles;
    volumeSeries.setData(toVolumeSeriesData(sourceCandles));
  }, [
    candles,
    currentCandle
  ]);
  useEffect(() => {
    const volumeProfilePrimitive = volumeProfilePrimitiveRef.current;
    if (!volumeProfilePrimitive) {
      return;
    }
    const sourceCandles = currentCandle
      ? [...candles, currentCandle]
      : candles;
    const profile = createVolumeProfileData(sourceCandles);
    volumeProfilePrimitive.setData(profile);
  }, [
    candles,
    currentCandle
  ]);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const activeSessions = new Set(vwapSessions.map((session) => session.sessionStart));
    for (const [sessionStart, series] of vwapSeriesRef.current) {
      if (!activeSessions.has(sessionStart)) {
        chart.removeSeries(series);
        vwapSeriesRef.current.delete(sessionStart);
      }
    }
    const latestSession = vwapSessions[vwapSessions.length - 1]?.sessionStart;
    for (const session of vwapSessions) {
      let series = vwapSeriesRef.current.get(session.sessionStart);
      if (!series) {
        series = chart.addSeries(LineSeries, {
          color: "#fbbf24",
          lineWidth: 2,
          priceScaleId: "right",
          priceLineVisible: false,
          crosshairMarkerVisible: true,
          pointMarkersVisible: true,
          pointMarkersRadius: 2,
          visible: showVwap,
          title: "VWAP"
        }, 0);
        vwapSeriesRef.current.set(session.sessionStart, series);
      }
      series.setData([...session.points]);
      series.applyOptions({
        visible: showVwap,
        lastValueVisible: session.sessionStart === latestSession
      });
    }
  }, [vwapSessions, showVwap]);
  return (<section>
    <h2>Price Chart</h2>
    <div className="drawing-toolbar">
      <button type="button" aria-pressed={drawingTool ===
        "HORIZONTAL_LINE"} onClick={() => selectDrawingTool(drawingTool ===
          "HORIZONTAL_LINE"
          ? "CURSOR"
          : "HORIZONTAL_LINE")}>
        Horizontale Linie
      </button>
      <button type="button" aria-pressed={drawingTool === "RECTANGLE"} onClick={() => selectDrawingTool(drawingTool === "RECTANGLE" ? "CURSOR" : "RECTANGLE")}>
        Rechteck
      </button>
      <button type="button" disabled={selectedDrawingId === null} onClick={removeSelectedDrawing}>
        Ausgewählte Zeichnung löschen
      </button>
    </div>
    <div ref={containerRef} className="price-chart" style={{
      cursor: drawingTool === "CURSOR"
        ? "default"
        : "crosshair"
    }} />
  </section>);
}
