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

export function IndicatorControls({ showVwap, showVolume, showCvd, showDelta, onShowVwapChange, onShowVolumeChange, onShowCvdChange, onShowDeltaChange }: IndicatorControlsProps) {
  return (
    <fieldset className="control-panel indicator-panel">
      <legend>Indicators</legend>
      <label className="switch-row"><span>VWAP</span><input type="checkbox" checked={showVwap} onChange={(event) => onShowVwapChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      <label className="switch-row"><span>Volume</span><input type="checkbox" checked={showVolume} onChange={(event) => onShowVolumeChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      <label className="switch-row"><span>Cumulative delta</span><input type="checkbox" checked={showCvd} onChange={(event) => onShowCvdChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      <label className="switch-row"><span>Delta histogram</span><input type="checkbox" checked={showDelta} onChange={(event) => onShowDeltaChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
    </fieldset>
  );
}