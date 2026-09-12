import type {
  ICustomSeriesPaneRenderer,
  PaneRendererCustomData,
  PriceToCoordinateConverter,
  Time
} from "lightweight-charts";

import type {
  FootprintSeriesData
} from "./FootprintSeriesData";

type CanvasTarget = Parameters<
  ICustomSeriesPaneRenderer["draw"]
>[0];

const MINIMUM_BAR_SPACING = 70;
const MINIMUM_TEXT_BAR_SPACING = 110;
const MINIMUM_TEXT_CELL_HEIGHT = 14;
const CELL_WIDTH_FACTOR = 0.9;
const IMBALANCE_MARKER_WIDTH = 3;
const STACKED_IMBALANCE_MARKER_WIDTH = 6;

export class FootprintSeriesRenderer
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
          let index = visibleRange.from;
          index < visibleRange.to;
          index += 1
        ) {
          const bar = data.bars[index];

          if (!bar) {
            continue;
          }

          const candle =
            bar.originalData;

          const totalWidth =
            data.barSpacing *
            CELL_WIDTH_FACTOR;

          const halfWidth =
            totalWidth / 2;

          const left =
            bar.x - totalWidth / 2;

          const maximumVolume =
            calculateMaximumSideVolume(
              candle
            );

          const pointOfControlPrice =
            findPointOfControlPrice(
              candle
            );

          const imbalances =
            candle.analysis
              ?.imbalances ?? [];

          const buyImbalancePrices =
            new Set(
              imbalances
                .filter(
                  (imbalance) =>
                    imbalance.side ===
                    "BUY"
                )
                .map(
                  (imbalance) =>
                    imbalance.price
                )
            );

          const sellImbalancePrices =
            new Set(
              imbalances
                .filter(
                  (imbalance) =>
                    imbalance.side ===
                    "SELL"
                )
                .map(
                  (imbalance) =>
                    imbalance.price
                )
            );

          for (
            const level of candle.levels
          ) {
            const upperPrice =
              level.price +
              candle.priceStep / 2;

            const lowerPrice =
              level.price -
              candle.priceStep / 2;

            const upperY =
              priceToCoordinate(
                upperPrice
              );

            const lowerY =
              priceToCoordinate(
                lowerPrice
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

            const bidIntensity =
              level.bidVolume /
              maximumVolume;

            const askIntensity =
              level.askVolume /
              maximumVolume;

            drawBidCell(
              context,
              left,
              top,
              halfWidth,
              height,
              bidIntensity
            );

            drawAskCell(
              context,
              left + halfWidth,
              top,
              halfWidth,
              height,
              askIntensity
            );

            const isPointOfControl =
              level.price ===
              pointOfControlPrice;

            drawLevelBorder(
              context,
              left,
              top,
              totalWidth,
              height,
              isPointOfControl
            );

            drawCenterLine(
              context,
              left + halfWidth,
              top,
              height
            );

            const hasSellImbalance =
              sellImbalancePrices.has(
                level.price
              );

            const hasBuyImbalance =
              buyImbalancePrices.has(
                level.price
              );

            if (hasSellImbalance) {
              drawImbalanceMarker(
                context,
                left,
                top,
                totalWidth,
                height,
                "SELL"
              );
            }

            if (hasBuyImbalance) {
              drawImbalanceMarker(
                context,
                left,
                top,
                totalWidth,
                height,
                "BUY"
              );
            }

            const canDrawText =
              data.barSpacing >=
              MINIMUM_TEXT_BAR_SPACING &&
              height >=
              MINIMUM_TEXT_CELL_HEIGHT;

            if (canDrawText) {
              drawVolumeText(
                context,
                level.bidVolume,
                level.askVolume,
                left,
                top,
                halfWidth,
                height
              );
            }
          }
          drawStackedImbalanceMarkers(
            context,
            candle,
            left,
            totalWidth,
            priceToCoordinate
          );
        }
      }
    );
  }
}

function calculateMaximumSideVolume(
  candle: FootprintSeriesData
): number {
  return Math.max(
    Number.EPSILON,

    ...candle.levels.map(
      (level) =>
        Math.max(
          level.bidVolume,
          level.askVolume
        )
    )
  );
}

function findPointOfControlPrice(
  candle: FootprintSeriesData
): number | undefined {
  let pointOfControlPrice:
    number | undefined;

  let pointOfControlVolume = -1;

  for (const level of candle.levels) {
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

  return pointOfControlPrice;
}

function drawBidCell(
  context:
    CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  intensity: number
): void {
  context.fillStyle =
    createVolumeColor(
      239,
      68,
      68,
      intensity
    );

  context.fillRect(
    left,
    top,
    width,
    height
  );
}

function drawAskCell(
  context:
    CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  intensity: number
): void {
  context.fillStyle =
    createVolumeColor(
      34,
      197,
      94,
      intensity
    );

  context.fillRect(
    left,
    top,
    width,
    height
  );
}

function drawLevelBorder(
  context:
    CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  isPointOfControl: boolean
): void {
  context.strokeStyle =
    isPointOfControl
      ? "#f59e0b"
      : "#334155";

  context.lineWidth =
    isPointOfControl ? 2 : 1;

  context.strokeRect(
    left,
    top,
    width,
    height
  );
}

function drawCenterLine(
  context:
    CanvasRenderingContext2D,
  centerX: number,
  top: number,
  height: number
): void {
  context.beginPath();

  context.moveTo(
    centerX,
    top
  );

  context.lineTo(
    centerX,
    top + height
  );

  context.strokeStyle = "#334155";
  context.lineWidth = 1;
  context.stroke();
}

function drawImbalanceMarker(
  context:
    CanvasRenderingContext2D,
  left: number,
  top: number,
  totalWidth: number,
  height: number,
  side: "BUY" | "SELL"
): void {
  const markerLeft =
    side === "SELL"
      ? left
      : left +
      totalWidth -
      IMBALANCE_MARKER_WIDTH;

  context.fillStyle =
    side === "BUY"
      ? "#86efac"
      : "#fda4af";

  context.fillRect(
    markerLeft,
    top,
    IMBALANCE_MARKER_WIDTH,
    height
  );
}

function drawStackedImbalanceMarkers(
  context:
    CanvasRenderingContext2D,
  candle: FootprintSeriesData,
  left: number,
  totalWidth: number,
  priceToCoordinate:
    PriceToCoordinateConverter
): void {
  const stackedImbalances =
    candle.analysis
      ?.stackedImbalances ?? [];

  for (
    const stackedImbalance
    of stackedImbalances
  ) {
    const upperPrice =
      stackedImbalance.highPrice +
      candle.priceStep / 2;

    const lowerPrice =
      stackedImbalance.lowPrice -
      candle.priceStep / 2;

    const upperY =
      priceToCoordinate(upperPrice);

    const lowerY =
      priceToCoordinate(lowerPrice);

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
      2,
      Math.abs(lowerY - upperY)
    );

    const markerGap = 4;

    const markerLeft =
      stackedImbalance.side === "SELL"
        ? left -
        markerGap -
        STACKED_IMBALANCE_MARKER_WIDTH
        : left +
        totalWidth +
        markerGap;

    context.fillStyle =
      stackedImbalance.side === "BUY"
        ? "#22c55e"
        : "#ef4444";

    context.fillRect(
      markerLeft,
      top,
      STACKED_IMBALANCE_MARKER_WIDTH,
      height
    );
  }
}
function drawVolumeText(
  context:
    CanvasRenderingContext2D,
  bidVolume: number,
  askVolume: number,
  left: number,
  top: number,
  halfWidth: number,
  height: number
): void {
  const centerY =
    top + height / 2;

  context.font =
    "11px ui-monospace, " +
    "SFMono-Regular, Menlo, " +
    "Consolas, monospace";

  context.textBaseline = "middle";
  context.fillStyle = "#f8fafc";

  context.textAlign = "right";

  context.fillText(
    formatVolume(bidVolume),
    left + halfWidth - 4,
    centerY,
    halfWidth - 8
  );

  context.textAlign = "left";

  context.fillText(
    formatVolume(askVolume),
    left + halfWidth + 4,
    centerY,
    halfWidth - 8
  );
}

function createVolumeColor(
  red: number,
  green: number,
  blue: number,
  intensity: number
): string {
  const normalizedIntensity =
    Math.min(
      1,
      Math.max(0, intensity)
    );

  const alpha =
    0.15 +
    normalizedIntensity * 0.75;

  return (
    `rgba(${red}, ${green}, ` +
    `${blue}, ${alpha})`
  );
}

function formatVolume(
  volume: number
): string {
  if (volume === 0) {
    return "";
  }

  if (volume >= 1_000) {
    return `${(
      volume / 1_000
    ).toFixed(1)}k`;
  }

  if (volume >= 100) {
    return volume.toFixed(0);
  }

  if (volume >= 10) {
    return volume.toFixed(1);
  }

  return volume.toFixed(3);
}