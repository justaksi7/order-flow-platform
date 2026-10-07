import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
});
export function berlinDay(date = new Date()): string {
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export const pages = new Set(["/", "/order-flow", "/education"]);

export class Analytics {
  private readonly db: DatabaseSync;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;
  constructor(path = process.env.ANALYTICS_DB_PATH ?? "./data/analytics.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS totals (
        day TEXT NOT NULL, kind TEXT NOT NULL, route TEXT NOT NULL,
        method TEXT NOT NULL, status INTEGER NOT NULL,
        count INTEGER NOT NULL, duration REAL NOT NULL,
        PRIMARY KEY(day, kind, route, method, status));`);
    this.cleanup();
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }
  private cleanup(): void {
    // Retain today and the previous 89 Berlin calendar days, including DST changes.
    const cutoff = new Date(`${berlinDay()}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 89);
    this.db.prepare("DELETE FROM totals WHERE day < ?").run(berlinDay(cutoff));
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }
  record(kind: "page" | "request" | "websocket", route: string, method = "", status = 0, duration = 0): void {
    this.db.prepare(`INSERT INTO totals VALUES (?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(day, kind, route, method, status)
      DO UPDATE SET count=count+1, duration=duration+excluded.duration`)
      .run(berlinDay(), kind, route, method, status, duration);
  }
  summary(day: string) {
    const rows = this.db.prepare("SELECT * FROM totals WHERE day = ? ORDER BY kind, route, method, status").all(day);
    return {
      date: day, timezone: "Europe/Berlin",
      pageviews: rows.filter(row => row.kind === "page").reduce((sum, row) => sum + Number(row.count), 0),
      pages: rows.filter(row => row.kind === "page").map(row => ({ page: row.route, views: row.count })),
      requests: rows.filter(row => row.kind === "request").map(row => ({
        method: row.method, route: row.route, status: row.status, count: row.count,
        averageDurationMs: Math.round(Number(row.duration) / Number(row.count) * 100) / 100
      })),
      websocketConnections: rows.filter(row => row.kind === "websocket").reduce((sum, row) => sum + Number(row.count), 0)
    };
  }
  close(): void { clearInterval(this.cleanupTimer); this.db.close(); }
}
