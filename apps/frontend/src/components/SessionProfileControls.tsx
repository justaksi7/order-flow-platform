import { PROFILE_SESSIONS } from "../charts/volumeProfile/sessionProfile";
import type { ProfileDay, ProfileSession } from "../charts/volumeProfile/sessionProfile";

type SessionProfileControlsProps = {
  readonly showProfile: boolean;
  readonly profileSession: ProfileSession;
  readonly profileDay: ProfileDay;
  readonly onShowProfileChange: (value: boolean) => void;
  readonly onProfileSessionChange: (value: ProfileSession) => void;
  readonly onProfileDayChange: (value: ProfileDay) => void;
};

export function SessionProfileControls({ showProfile, profileSession, profileDay, onShowProfileChange, onProfileSessionChange, onProfileDayChange }: SessionProfileControlsProps) {
  return (
    <fieldset className="control-panel session-panel">
      <legend>Session Volume Profile</legend>
      <label className="switch-row"><span>Show profile</span><input type="checkbox" checked={showProfile} onChange={(event) => onShowProfileChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      <label className="select-row"><span>Session</span><select value={profileSession} onChange={(event) => onProfileSessionChange(event.target.value as ProfileSession)}>
        {Object.entries(PROFILE_SESSIONS).map(([id, session]) => <option key={id} value={id}>{session.label}</option>)}
      </select></label>
      <label className="select-row"><span>Day</span><select value={profileDay} onChange={(event) => onProfileDayChange(event.target.value as ProfileDay)}>
        <option value="TODAY">Today</option>
        <option value="YESTERDAY">Yesterday</option>
      </select></label>
    </fieldset>
  );
}