import type {
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time
} from "lightweight-charts";

import type {
  VolumeProfileData
} from "./VolumeProfileData";

import {
  VolumeProfilePaneView
} from "./VolumeProfilePaneView";

export class VolumeProfilePrimitive
  implements ISeriesPrimitive<Time> {
  private readonly paneView:
    VolumeProfilePaneView;

  private profile:
    VolumeProfileData | null = null;

  private requestUpdate:
    (() => void) | undefined;

  public constructor(
    series: ISeriesApi<"Candlestick">
  ) {
    this.paneView =
      new VolumeProfilePaneView(
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
      this.profile
    );
  }

  public paneViews():
    readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  public setData(
    profile:
      VolumeProfileData | null
  ): void {
    this.profile = profile;

    this.paneView.update(
      this.profile
    );

    this.requestUpdate?.();
  }
}