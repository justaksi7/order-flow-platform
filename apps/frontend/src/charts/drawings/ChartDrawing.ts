import type {
  Time
} from "lightweight-charts";

export type DrawingPoint = {
  readonly time: Time;
  readonly price: number;
};

export type RectangleDrawing = {
  readonly id: string;
  readonly type: "RECTANGLE";
  readonly start: DrawingPoint;
  readonly end: DrawingPoint;
  readonly borderColor: string;
  readonly backgroundColor: string;
};