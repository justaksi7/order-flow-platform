import {
  useEffect,
  useRef
} from "react";

import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
  WhitespaceData
} from "lightweight-charts";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  HistogramSeries
} from "lightweight-charts";

import type {
  ServerMessage
} from "@orderflow/protocol";

import {
  toDeltaHistogramSeriesData
} from "../charts/cumulativeDelta/toDeltaHistogramSeriesData";

import {
  FootprintSeries
} from "../charts/footprint/FootprintSeries";

import {
  toFootprintSeriesData
} from "../charts/footprint/FootprintSeriesData";

import type {
  FootprintSeriesData
} from "../charts/footprint/FootprintSeriesData";

import {
  toCumulativeDeltaSeriesData
} from "../charts/cumulativeDelta/toCumulativeDeltaSeriesData";

import {
  toVolumeSeriesData
} from "../charts/volume/toVolumeSeriesData";

import {
  createVolumeProfileData
} from "../charts/volumeProfile/VolumeProfileData";

import {
  VolumeProfilePrimitive
} from "../charts/volumeProfile/VolumeProfilePrimitive";

import {
  CandleVolumeProfileSeries
} from "../charts/candleVolumeProfile/CandleVolumeProfileSeries";

import type {
  OrderFlowDisplayMode
} from "../charts/OrderFlowDisplayMode";


type SnapshotMessage = Extract<
  ServerMessage,
  { type: "SNAPSHOT" }
>;

type SerializedCandle =
  SnapshotMessage["candles"][number];

type PriceChartProps = {
  readonly candles: readonly SerializedCandle[];
  readonly currentCandle: SerializedCandle | null;
  readonly displayMode: OrderFlowDisplayMode;
};

function toCandlestickData(
  candle: SerializedCandle
): CandlestickData<Time> {
  return {
    time: Math.floor(
      candle.startTime / 1_000
    ) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  };
}

export function PriceChart({
  candles,
  currentCandle,
  displayMode
}: PriceChartProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const chartRef =
    useRef<IChartApi | null>(null);

  const seriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(
      null
    );

  const cumulativeDeltaSeriesRef =
    useRef<ISeriesApi<"Line"> | null>(
      null
    );

  const footprintSeriesRef =
    useRef<
      ISeriesApi<
        "Custom",
        Time,
        FootprintSeriesData | WhitespaceData<Time>
      > | null
    >(null);

  const candleVolumeProfileSeriesRef =
    useRef<
      ISeriesApi<
        "Custom",
        Time,
        | FootprintSeriesData
        | WhitespaceData<Time>
      > | null
    >(null);

  const deltaHistogramSeriesRef =
    useRef<
      ISeriesApi<"Histogram"> | null
    >(null);

  const volumeSeriesRef =
    useRef<
      ISeriesApi<"Histogram"> | null
    >(null);

  const hasFittedContentRef =
    useRef(false);

  const volumeProfilePrimitiveRef =
    useRef<VolumeProfilePrimitive | null>(
      null
    );

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

    const series = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444"
      }
    );

    const volumeProfilePrimitive =
      new VolumeProfilePrimitive(
        series
      );

    series.attachPrimitive(
      volumeProfilePrimitive
    );

    const footprintSeries =
      chart.addCustomSeries(
        new FootprintSeries(),
        {
          visible: false
        }
      );

    const candleVolumeProfileSeries =
      chart.addCustomSeries(
        new CandleVolumeProfileSeries(),
        {
          visible: false
        }
      );

    const deltaHistogramSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceScaleId: "delta",
          priceLineVisible: false,
          lastValueVisible: false,
          base: 0,
          title: "Delta"
        },
        1
      );

    deltaHistogramSeries
      .priceScale()
      .applyOptions({
        scaleMargins: {
          top: 0.65,
          bottom: 0.05
        }
      });

    const cumulativeDeltaSeries =
      chart.addSeries(
        LineSeries,
        {
          color: "#38bdf8",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          title: "CVD"
        },
        1
      );

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: "volume"
          },
          priceLineVisible: false,
          lastValueVisible: true,
          title: "Volume"
        },
        2
      );

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

      series.detachPrimitive(
        volumeProfilePrimitive
      );


      chart.remove();

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
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;

    const footprintSeries =
      footprintSeriesRef.current;

    const candleVolumeProfileSeries =
      candleVolumeProfileSeriesRef.current;

    if (
      !chart ||
      !series ||
      !footprintSeries ||
      !candleVolumeProfileSeries
    ) {
      return;
    }

    const isNormal =
      displayMode === "NORMAL";

    const isFootprint =
      displayMode === "FOOTPRINT";

    const isCandleVolumeProfile =
      displayMode ===
      "CANDLE_VOLUME_PROFILE";

    const transparent =
      "rgba(0, 0, 0, 0)";

    series.applyOptions({
      visible: true,

      upColor:
        isNormal
          ? "#22c55e"
          : transparent,

      downColor:
        isNormal
          ? "#ef4444"
          : transparent,

      wickUpColor:
        isNormal
          ? "#22c55e"
          : transparent,

      wickDownColor:
        isNormal
          ? "#ef4444"
          : transparent
    });

    footprintSeries.applyOptions({
      visible: isFootprint
    });

    candleVolumeProfileSeries.applyOptions({
      visible:
        isCandleVolumeProfile
    });

    if (!isNormal) {
      const timeScale =
        chart.timeScale();

      const currentBarSpacing =
        timeScale.options().barSpacing;

      if (currentBarSpacing < 70) {
        timeScale.applyOptions({
          barSpacing: 70
        });
      }
    }
  }, [displayMode]);

  useEffect(() => {
    const series =
      seriesRef.current;

    const footprintSeries =
      footprintSeriesRef.current;

    const candleVolumeProfileSeries =
      candleVolumeProfileSeriesRef.current;

    if (
      !series ||
      !footprintSeries ||
      !candleVolumeProfileSeries
    ) {
      return;
    }

    const chartData =
      candles.map(
        toCandlestickData
      );

    const footprintData =
      candles.map(
        toFootprintSeriesData
      );

    series.setData(
      chartData
    );

    footprintSeries.setData(
      footprintData
    );

    candleVolumeProfileSeries.setData(
      footprintData
    );

    if (
      chartData.length > 0 &&
      !hasFittedContentRef.current
    ) {
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

    const footprintData =
      toFootprintSeriesData(
        currentCandle
      );

    seriesRef.current?.update(
      toCandlestickData(
        currentCandle
      )
    );

    footprintSeriesRef.current?.update(
      footprintData
    );

    candleVolumeProfileSeriesRef.current
      ?.update(
        footprintData
      );
  }, [currentCandle]);

  useEffect(() => {
    const cumulativeDeltaSeries =
      cumulativeDeltaSeriesRef.current;

    const deltaHistogramSeries =
      deltaHistogramSeriesRef.current;

    if (
      !cumulativeDeltaSeries ||
      !deltaHistogramSeries
    ) {
      return;
    }

    const sourceCandles =
      currentCandle
        ? [...candles, currentCandle]
        : candles;

    cumulativeDeltaSeries.setData(
      toCumulativeDeltaSeriesData(
        sourceCandles
      )
    );

    deltaHistogramSeries.setData(
      toDeltaHistogramSeriesData(
        sourceCandles
      )
    );
  }, [
    candles,
    currentCandle
  ]);

  useEffect(() => {
    const volumeSeries =
      volumeSeriesRef.current;

    if (!volumeSeries) {
      return;
    }

    const sourceCandles =
      currentCandle
        ? [...candles, currentCandle]
        : candles;

    volumeSeries.setData(
      toVolumeSeriesData(
        sourceCandles
      )
    );
  }, [
    candles,
    currentCandle
  ]);

  useEffect(() => {
    const volumeProfilePrimitive =
      volumeProfilePrimitiveRef.current;

    if (!volumeProfilePrimitive) {
      return;
    }

    const sourceCandles =
      currentCandle
        ? [...candles, currentCandle]
        : candles;

    const profile =
      createVolumeProfileData(
        sourceCandles
      );

    volumeProfilePrimitive.setData(
      profile
    );
  }, [
    candles,
    currentCandle
  ]);

  return (
    <section>
      <h2>Price Chart</h2>

      <div
        ref={containerRef}
        className="price-chart"
      />
    </section>
  );
}