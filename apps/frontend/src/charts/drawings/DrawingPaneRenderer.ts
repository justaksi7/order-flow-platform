import type {
  IPrimitivePaneRenderer
} from "lightweight-charts";

type CanvasTarget = Parameters<
  IPrimitivePaneRenderer["draw"]
>[0];

export type RectangleCoordinates = {
  readonly id: string;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly borderColor: string;
  readonly backgroundColor: string;
  readonly selected: boolean;
};

export class DrawingPaneRenderer
  implements IPrimitivePaneRenderer {
  private rectangles:
    readonly RectangleCoordinates[] = [];

  public update(
    rectangles:
      readonly RectangleCoordinates[]
  ): void {
    this.rectangles = rectangles;
  }

  public draw(
    target: CanvasTarget
  ): void {
    target.useMediaCoordinateSpace(
      ({ context }) => {
        context.save();

        for (
          const rectangle of
          this.rectangles
        ) {
          const left = Math.min(
            rectangle.startX,
            rectangle.endX
          );

          const top = Math.min(
            rectangle.startY,
            rectangle.endY
          );

          const width = Math.abs(
            rectangle.endX -
            rectangle.startX
          );

          const height = Math.abs(
            rectangle.endY -
            rectangle.startY
          );

          context.fillStyle =
            rectangle.backgroundColor;

          context.fillRect(
            left,
            top,
            width,
            height
          );

          context.strokeStyle =
            rectangle.selected
              ? "#fde047"
              : rectangle.borderColor;

          context.lineWidth =
            rectangle.selected
              ? 3
              : 2;

          context.setLineDash(
            rectangle.selected
              ? [6, 3]
              : []
          );

          context.strokeRect(
            left,
            top,
            width,
            height
          );
        }

        context.restore();
      }
    );
  }
}