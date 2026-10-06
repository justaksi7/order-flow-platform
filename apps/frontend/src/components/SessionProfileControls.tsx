import { PROFILE_SESSIONS } from "../charts/volumeProfile/sessionProfile";
import type { ProfileDay, ProfileSession } from "../charts/volumeProfile/sessionProfile";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

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
    <div className="control-panel session-panel">
      <Label className="panel-label">Session Volume Profile</Label>
      <label className="switch-row"><span>Show profile</span><Switch checked={showProfile} onCheckedChange={onShowProfileChange} /></label>
      <div className="select-row"><Label htmlFor="profile-session">Session</Label><Select value={profileSession} onValueChange={(value) => onProfileSessionChange(value as ProfileSession)}>
        <SelectTrigger id="profile-session" aria-label="Session"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(PROFILE_SESSIONS).map(([id, session]) => <SelectItem key={id} value={id}>{session.label}</SelectItem>)}</SelectContent>
      </Select></div>
      <div className="select-row"><Label htmlFor="profile-day">Day</Label><Select value={profileDay} onValueChange={(value) => onProfileDayChange(value as ProfileDay)}>
        <SelectTrigger id="profile-day" aria-label="Day"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="TODAY">Today</SelectItem><SelectItem value="YESTERDAY">Yesterday</SelectItem></SelectContent>
      </Select></div>
    </div>
  );
}