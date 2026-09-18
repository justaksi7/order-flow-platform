import type { TimeFrame } from "@orderflow/domain";
import type { OrderFlowDisplayMode } from "../charts/OrderFlowDisplayMode";

type ChartControlsProps = {
  readonly timeFrames: readonly TimeFrame[];
  readonly selectedTimeFrame: TimeFrame;
  readonly onTimeFrameChange: (timeFrame: TimeFrame) => void;
  readonly displayMode: OrderFlowDisplayMode;
  readonly onDisplayModeChange: (displayMode: OrderFlowDisplayMode) => void;
};

const DISPLAY_MODES: readonly { value: OrderFlowDisplayMode; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "FOOTPRINT", label: "Footprint" },
  { value: "CANDLE_VOLUME_PROFILE", label: "Candle Volume Profile" }
];

export function ChartControls({ timeFrames, selectedTimeFrame, onTimeFrameChange, displayMode, onDisplayModeChange }: ChartControlsProps) {
  return (
    <div className="chart-controls compact-controls">
      <label className="toolbar-field">
        <span className="control-label">Timeframe</span>
        <select value={selectedTimeFrame} onChange={(event) => onTimeFrameChange(event.target.value as TimeFrame)}>
          {timeFrames.map((timeFrame) => <option key={timeFrame} value={timeFrame}>{timeFrame}</option>)}
        </select>
      </label>
      <label className="toolbar-field chart-type-field">
        <span className="control-label">Chart type</span>
        <select value={displayMode} onChange={(event) => onDisplayModeChange(event.target.value as OrderFlowDisplayMode)}>
          {DISPLAY_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
      </label>
    </div>
  );
}