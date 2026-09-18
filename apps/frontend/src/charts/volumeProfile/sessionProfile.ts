import type { SerializedFootprintCandle } from "@orderflow/domain";

// Configurable analysis windows in local time, not exchange opening hours.
export const PROFILE_SESSIONS = {
  SYDNEY: { label: "Sydney", timeZone: "Australia/Sydney", startHour: 8, endHour: 17 },
  TOKYO: { label: "Tokyo", timeZone: "Asia/Tokyo", startHour: 9, endHour: 18 },
  LONDON: { label: "London", timeZone: "Europe/London", startHour: 8, endHour: 17 },
  NEW_YORK: { label: "New York", timeZone: "America/New_York", startHour: 8, endHour: 17 }
} as const;
export type ProfileSession = keyof typeof PROFILE_SESSIONS;
export type ProfileDay = "TODAY" | "YESTERDAY";

function parts(timestamp: number, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(timestamp);
  const get = (type: string) => Number(values.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"), second: get("second") };
}

// Resolve a local wall-clock time using the zone's offset on that date.
// Configured sessions start/end outside DST's ambiguous transition hours.
function localToUtc(local: number, timeZone: string): number {
  let timestamp = local;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const p = parts(timestamp, timeZone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const difference = local - represented;
    timestamp += difference;
    if (difference === 0) return timestamp;
  }
  throw new Error("Cannot resolve session time");
}

export function getSessionWindow(session: ProfileSession, day: ProfileDay, now: number) {
  const config = PROFILE_SESSIONS[session];
  const p = parts(now, config.timeZone);
  const date = Date.UTC(p.year, p.month - 1, p.day - (day === "YESTERDAY" ? 1 : 0));
  const start = localToUtc(date + config.startHour * 3_600_000, config.timeZone);
  const end = localToUtc(date + config.endHour * 3_600_000, config.timeZone);
  return { start, end, date: new Date(date).toISOString().slice(0, 10), ...config };
}

export function selectSessionCandles(
  candles: readonly SerializedFootprintCandle[],
  currentCandle: SerializedFootprintCandle | null,
  session: ProfileSession, day: ProfileDay, now: number
) {
  const window = getSessionWindow(session, day, now);
  const byTime = new Map(candles.map((candle) => [candle.startTime, candle]));
  if (currentCandle) byTime.set(currentCandle.startTime, currentCandle);
  const selected = [...byTime.values()].filter((candle) =>
    candle.startTime >= window.start && candle.startTime < window.end &&
    candle.startTime <= now && candle.endTime <= window.end
  ).sort((a, b) => a.startTime - b.startTime);
  const first = selected[0];
  const last = selected[selected.length - 1];
  let hasGap = false;
  for (let i = 1; i < selected.length; i += 1) {
    const previous = selected[i - 1];
    const next = selected[i];
    if (previous && next && next.startTime > previous.endTime) hasGap = true;
  }
  const partial = !!first && !!last && (first.startTime > window.start ||
    last.endTime < Math.min(now, window.end) || hasGap);
  const phase = now < window.start ? "upcoming" : now < window.end ? "live" : "ended";
  return { window, candles: selected, partial, phase };
}
