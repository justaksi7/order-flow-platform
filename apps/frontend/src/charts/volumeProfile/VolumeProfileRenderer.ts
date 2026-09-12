import type {
  IPrimitivePaneRenderer
} from "lightweight-charts";

type CanvasTarget = Parameters<
  IPrimitivePaneRenderer["draw"]
>[0];

export type VolumeProfileLevelRenderData = {
  readonly top: number;
  readonly height: number;
  readonly volumeRatio: number;
  readonly bidRatio: number;
  readonly askRatio: number;
  readonly isPointOfControl: boolean;
  readonly isInsideValueArea: boolean;
};

export class VolumeProfileRenderer
  implements IPrimitivePaneRenderer {
  private levels:
    readonly VolumeProfileLevelRenderData[] =
      [];

  public update(
    levels:
      readonly VolumeProfileLevelRenderData[]
  ): void {
    this.levels = levels;
  }

  public draw(
    target: CanvasTarget
  ): void {
    target.useMediaCoordinateSpace(
      ({
        context,
        mediaSize
      }) => {
        const maximumProfileWidth =
          Math.min(
            220,
            mediaSize.width * 0.28
          );

        const right =
          mediaSize.width - 8;

        for (const level of this.levels) {
          const totalWidth =
            maximumProfileWidth *
            level.volumeRatio;

          const bidWidth =
            totalWidth *
            level.bidRatio;

          const askWidth =
            totalWidth *
            level.askRatio;

          const left =
            right - totalWidth;

          const opacity =
            level.isInsideValueArea
              ? 0.72
              : 0.28;

          context.fillStyle =
            `rgba(239, 68, 68, ${opacity})`;

          context.fillRect(
            left,
            level.top,
            bidWidth,
            level.height
          );

          context.fillStyle =
            `rgba(34, 197, 94, ${opacity})`;

          context.fillRect(
            left + bidWidth,
            level.top,
            askWidth,
            level.height
          );

          if (level.isPointOfControl) {
            context.strokeStyle =
              "#f59e0b";

            context.lineWidth = 2;

            context.strokeRect(
              left,
              level.top,
              totalWidth,
              level.height
            );
          }
        }
      }
    );
  }
}