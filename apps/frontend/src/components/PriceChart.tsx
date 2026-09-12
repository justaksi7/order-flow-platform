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
  createChart
} from "lightweight-charts";

import type {
  ServerMessage
} from "@orderflow/protocol";

import {
  FootprintSeries
} from "../charts/footprint/FootprintSeries";

import {
  toFootprintSeriesData
} from "../charts/footprint/FootprintSeriesData";

import type {
  FootprintSeriesData
} from "../charts/footprint/FootprintSeriesData";

const FOOTPRINT_MODE_ENTER_SPACING = 80;
const FOOTPRINT_MODE_EXIT_SPACING = 70;

type SnapshotMessage = Extract<
  ServerMessage,
  { type: "SNAPSHOT" }
>;

type SerializedCandle =
  SnapshotMessage["candles"][number];

type PriceChartProps = {
  readonly candles: readonly SerializedCandle[];
  readonly currentCandle: SerializedCandle | null;
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
  currentCandle
}: PriceChartProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const chartRef =
    useRef<IChartApi | null>(null);

  const seriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(
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

  const hasFittedContentRef =
    useRef(false);

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

    const footprintSeries =
      chart.addCustomSeries(
        new FootprintSeries(),
        {
          visible: false
        }
      );

    let isFootprintMode = false;

    function updateChartMode(): void {
      const barSpacing =
        chart.timeScale()
          .options()
          .barSpacing;

      if (
        !isFootprintMode &&
        barSpacing >=
        FOOTPRINT_MODE_ENTER_SPACING
      ) {
        isFootprintMode = true;

        series.applyOptions({
          visible: false
        });

        footprintSeries.applyOptions({
          visible: true
        });

        return;
      }

      if (
        isFootprintMode &&
        barSpacing <=
        FOOTPRINT_MODE_EXIT_SPACING
      ) {
        isFootprintMode = false;

        series.applyOptions({
          visible: true
        });

        footprintSeries.applyOptions({
          visible: false
        });
      }
    }

    chart.timeScale()
      .subscribeVisibleLogicalRangeChange(
        updateChartMode
      );

    updateChartMode();

    chartRef.current = chart;
    seriesRef.current = series;
    footprintSeriesRef.current = footprintSeries;

    return () => {
      chart.timeScale()
        .unsubscribeVisibleLogicalRangeChange(
          updateChartMode
        );

      chart.remove();

      chartRef.current = null;
      seriesRef.current = null;
      footprintSeriesRef.current = null;
      hasFittedContentRef.current = false;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const footprintSeries =
      footprintSeriesRef.current;

    if (!series || !footprintSeries) {
      return;
    }

    const chartData = candles.map(
      toCandlestickData
    );
    const footprintData = candles.map(
      toFootprintSeriesData
    );

    series.setData(chartData);
    footprintSeries.setData(footprintData);

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

    seriesRef.current?.update(
      toCandlestickData(currentCandle)
    );

    footprintSeriesRef.current?.update(
      toFootprintSeriesData(currentCandle)
    );
  }, [currentCandle]);

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