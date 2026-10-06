import type { TimeFrame } from "@orderflow/domain";
import type { OrderFlowDisplayMode } from "../charts/OrderFlowDisplayMode";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

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
      <div className="toolbar-field">
        <Label>Timeframe</Label>
        <Select value={selectedTimeFrame} onValueChange={(value) => onTimeFrameChange(value as TimeFrame)}>
          <SelectTrigger aria-label="Timeframe"><SelectValue /></SelectTrigger>
          <SelectContent>{timeFrames.map((timeFrame) => <SelectItem key={timeFrame} value={timeFrame}>{timeFrame}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="toolbar-field chart-type-field">
        <Label>Chart type</Label>
        <Select value={displayMode} onValueChange={(value) => onDisplayModeChange(value as OrderFlowDisplayMode)}>
          <SelectTrigger aria-label="Chart type"><SelectValue /></SelectTrigger>
          <SelectContent>{DISPLAY_MODES.map((mode) => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}