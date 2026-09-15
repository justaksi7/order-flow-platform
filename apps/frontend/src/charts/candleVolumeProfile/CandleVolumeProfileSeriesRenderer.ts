import type {
  ICustomSeriesPaneRenderer,
  PaneRendererCustomData,
  PriceToCoordinateConverter,
  Time
} from "lightweight-charts";

import type {
  FootprintSeriesData
} from "../footprint/FootprintSeriesData";

type CanvasTarget = Parameters<
  ICustomSeriesPaneRenderer["draw"]
>[0];

const MINIMUM_BAR_SPACING = 1;
const PROFILE_WIDTH_FACTOR = 0.65;
const CANDLE_OFFSET_FACTOR = 0.35;

export class CandleVolumeProfileSeriesRenderer
  implements ICustomSeriesPaneRenderer {
  private data:
    PaneRendererCustomData<
      Time,
      FootprintSeriesData
    > | null = null;

  public update(
    data: PaneRendererCustomData<
      Time,
      FootprintSeriesData
    >
  ): void {
    this.data = data;
  }

  public draw(
    target: CanvasTarget,
    priceToCoordinate:
      PriceToCoordinateConverter
  ): void {
    const data = this.data;

    if (
      !data ||
      data.visibleRange === null ||
      data.bars.length === 0 ||
      data.barSpacing <
        MINIMUM_BAR_SPACING
    ) {
      return;
    }

    const visibleRange =
      data.visibleRange;

    target.useMediaCoordinateSpace(
      ({ context }) => {
        for (
          let index =
            visibleRange.from;
          index <
            visibleRange.to;
          index += 1
        ) {
          const bar =
            data.bars[index];

          if (!bar) {
            continue;
          }

          const candle =
            bar.originalData;

          const candleX =
            bar.x -
            data.barSpacing *
              CANDLE_OFFSET_FACTOR;

          const profileLeft =
            candleX + 4;

          const maximumProfileWidth =
            data.barSpacing *
            PROFILE_WIDTH_FACTOR;

          const maximumLevelVolume =
            Math.max(
              Number.EPSILON,
              ...candle.levels.map(
                (level) =>
                  level.bidVolume +
                  level.askVolume
              )
            );

          let pointOfControlPrice:
            number | undefined;

          let pointOfControlVolume = -1;

          for (
            const level of
            candle.levels
          ) {
            const totalVolume =
              level.bidVolume +
              level.askVolume;

            if (
              totalVolume >
              pointOfControlVolume
            ) {
              pointOfControlVolume =
                totalVolume;

              pointOfControlPrice =
                level.price;
            }
          }

          drawReferenceCandle(
            context,
            candle,
            candleX,
            priceToCoordinate
          );

          for (
            const level of
            candle.levels
          ) {
            const upperY =
              priceToCoordinate(
                level.price +
                  candle.priceStep / 2
              );

            const lowerY =
              priceToCoordinate(
                level.price -
                  candle.priceStep / 2
              );

            if (
              upperY === null ||
              lowerY === null
            ) {
              continue;
            }

            const top = Math.min(
              upperY,
              lowerY
            );

            const height = Math.max(
              1,
              Math.abs(
                lowerY - upperY
              )
            );

            const totalVolume =
              level.bidVolume +
              level.askVolume;

            const totalWidth =
              maximumProfileWidth *
              (
                totalVolume /
                maximumLevelVolume
              );

            const bidRatio =
              totalVolume > 0
                ? level.bidVolume /
                  totalVolume
                : 0;

            const bidWidth =
              totalWidth * bidRatio;

            const askWidth =
              totalWidth - bidWidth;

            const isInsideValueArea =
              level.price >=
                candle.valueAreaLow &&
              level.price <=
                candle.valueAreaHigh;

            const opacity =
              isInsideValueArea
                ? 0.8
                : 0.3;

            context.fillStyle =
              `rgba(239, 68, 68, ` +
              `${opacity})`;

            context.fillRect(
              profileLeft,
              top,
              bidWidth,
              height
            );

            context.fillStyle =
              `rgba(34, 197, 94, ` +
              `${opacity})`;

            context.fillRect(
              profileLeft + bidWidth,
              top,
              askWidth,
              height
            );

            if (
              level.price ===
              pointOfControlPrice
            ) {
              context.strokeStyle =
                "#f59e0b";

              context.lineWidth = 2;

              context.strokeRect(
                profileLeft,
                top,
                totalWidth,
                height
              );
            }
          }

          drawValueAreaMarker(
            context,
            profileLeft,
            profileLeft +
              maximumProfileWidth,
            priceToCoordinate(
              candle.valueAreaHigh
            ),
            "#38bdf8"
          );

          drawValueAreaMarker(
            context,
            profileLeft,
            profileLeft +
              maximumProfileWidth,
            priceToCoordinate(
              candle.valueAreaLow
            ),
            "#a78bfa"
          );
        }
      }
    );
  }
}

function drawReferenceCandle(
  context:
    CanvasRenderingContext2D,
  candle: FootprintSeriesData,
  x: number,
  priceToCoordinate:
    PriceToCoordinateConverter
): void {
  const openY =
    priceToCoordinate(candle.open);

  const highY =
    priceToCoordinate(candle.high);

  const lowY =
    priceToCoordinate(candle.low);

  const closeY =
    priceToCoordinate(candle.close);

  if (
    openY === null ||
    highY === null ||
    lowY === null ||
    closeY === null
  ) {
    return;
  }

  const color =
    candle.close >= candle.open
      ? "#22c55e"
      : "#ef4444";

  context.strokeStyle = color;
  context.lineWidth = 1;

  context.beginPath();
  context.moveTo(x, highY);
  context.lineTo(x, lowY);
  context.stroke();

  const bodyTop = Math.min(
    openY,
    closeY
  );

  const bodyHeight = Math.max(
    2,
    Math.abs(closeY - openY)
  );

  context.fillStyle = color;

  context.fillRect(
    x - 2,
    bodyTop,
    4,
    bodyHeight
  );
}

function drawValueAreaMarker(
  context:
    CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number | null,
  color: string
): void {
  if (y === null) {
    return;
  }

  context.save();

  context.beginPath();
  context.moveTo(left, y);
  context.lineTo(right, y);

  context.strokeStyle = color;
  context.lineWidth = 2;
  context.setLineDash([5, 3]);

  context.stroke();
  context.restore();
}