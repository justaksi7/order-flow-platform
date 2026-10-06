type IndicatorControlsProps = {
  readonly showVwap: boolean;
  readonly showVolume: boolean;
  readonly showCvd: boolean;
  readonly showDelta: boolean;
  readonly onShowVwapChange: (value: boolean) => void;
  readonly onShowVolumeChange: (value: boolean) => void;
  readonly onShowCvdChange: (value: boolean) => void;
  readonly onShowDeltaChange: (value: boolean) => void;
};

import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

export function IndicatorControls({ showVwap, showVolume, showCvd, showDelta, onShowVwapChange, onShowVolumeChange, onShowCvdChange, onShowDeltaChange }: IndicatorControlsProps) {
  return (
    <div className="control-panel indicator-panel">
      <Label className="panel-label">Indicators</Label>
      <label className="switch-row"><span>VWAP</span><Switch checked={showVwap} onCheckedChange={onShowVwapChange} /></label>
      <label className="switch-row"><span>Volume</span><Switch checked={showVolume} onCheckedChange={onShowVolumeChange} /></label>
      <label className="switch-row"><span>Cumulative delta</span><Switch checked={showCvd} onCheckedChange={onShowCvdChange} /></label>
      <label className="switch-row"><span>Delta histogram</span><Switch checked={showDelta} onCheckedChange={onShowDeltaChange} /></label>
    </div>
  );
}