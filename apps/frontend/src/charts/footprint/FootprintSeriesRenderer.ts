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

const MINIMUM_BAR_SPACING = 80;
const CELL_WIDTH_FACTOR = 0.9;
const MINIMUM_TEXT_BAR_SPACING = 110;
const MINIMUM_TEXT_CELL_HEIGHT = 14;

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
      data.barSpacing < MINIMUM_BAR_SPACING
    ) {
      return;
    }

    target.useMediaCoordinateSpace(
      ({ context }) => {
        const {
          from,
          to
        } = data.visibleRange!;

        for (
          let index = from;
          index < to;
          index += 1
        ) {
          const bar = data.bars[index];

          if (!bar) {
            continue;
          }

          const candle = bar.originalData;

          const totalWidth =
            data.barSpacing *
            CELL_WIDTH_FACTOR;

          const halfWidth =
            totalWidth / 2;

          const left =
            bar.x - totalWidth / 2;

          const maximumVolume = Math.max(
            Number.EPSILON,
            ...candle.levels.map(
              (level) =>
                Math.max(
                  level.bidVolume,
                  level.askVolume
                )
            )
          );

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

          for (const level of candle.levels) {
            const upperPrice =
              level.price +
              candle.priceStep / 2;

            const lowerPrice =
              level.price -
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
              1,
              Math.abs(lowerY - upperY)
            );

            const bidIntensity =
              level.bidVolume /
              maximumVolume;

            const askIntensity =
              level.askVolume /
              maximumVolume;

            // Bid-Z-Z-Zelle
            context.fillStyle =
              createVolumeColor(
                239,
                68,
                68,
                bidIntensity
              );

            context.fillRect(
              left,
              top,
              halfWidth,
              height
            );

            // Ask-Zelle
            context.fillStyle =
              createVolumeColor(
                34,
                197,
                94,
                askIntensity
              );

            context.fillRect(
              left + halfWidth,
              top,
              halfWidth,
              height
            );

            // POC-Rahmen
            const isPointOfControl =
              level.price ===
              pointOfControlPrice;

            context.strokeStyle =
              isPointOfControl
                ? "#f59e0b"
                : "#334155";

            context.lineWidth =
              isPointOfControl ? 2 : 1;

            context.strokeRect(
              left,
              top,
              totalWidth,
              height
            );

            // Mittlere Trennlinie
            context.beginPath();

            context.moveTo(
              left + halfWidth,
              top
            );

            context.lineTo(
              left + halfWidth,
              top + height
            );

            // Volumenzahlen
            const canDrawText =
              data.barSpacing >=
              MINIMUM_TEXT_BAR_SPACING &&
              height >=
              MINIMUM_TEXT_CELL_HEIGHT;

            if (canDrawText) {
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
                formatVolume(level.bidVolume),
                left + halfWidth - 4,
                centerY,
                halfWidth - 8
              );

              context.textAlign = "left";

              context.fillText(
                formatVolume(level.askVolume),
                left + halfWidth + 4,
                centerY,
                halfWidth - 8
              );
            }

            context.stroke();
          }
        }
      }
    );
  }
}

function createVolumeColor(
  red: number,
  green: number,
  blue: number,
  intensity: number
): string {
  const normalizedIntensity = Math.min(
    1,
    Math.max(0, intensity)
  );

  const alpha =
    0.15 +
    normalizedIntensity * 0.75;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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