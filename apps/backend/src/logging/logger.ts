import { mkdirSync, appendFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// Only fixed event codes and random request IDs may be passed. No Error objects.
export function logError(code: string, requestId?: string): void {
  const entry = JSON.stringify({ level: "error", time: new Date().toISOString(), code, ...(requestId ? { requestId } : {}) });
  const directory = process.env.ERROR_LOG_DIR;
  if (!directory) { console.error(entry); return; }
  try {
    mkdirSync(directory, { recursive: true });
    const now = Date.now();
    for (const name of readdirSync(directory)) {
      if (!/^errors-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) continue;
      // Delete at the start of day 8; files cover at most seven UTC calendar days.
      if (Date.parse(name.slice(7, 17)) < Date.parse(new Date(now).toISOString().slice(0, 10)) - 6 * 86400000) {
        unlinkSync(join(directory, name));
      }
    }
    appendFileSync(join(directory, `errors-${new Date(now).toISOString().slice(0, 10)}.jsonl`), entry + "\n", { mode: 0o600 });
  } catch { console.error(JSON.stringify({ level: "error", code: "ERROR_LOG_WRITE_FAILED" })); }
}

// Expiry must also run when no new errors occur.
export function startLogCleanup(): void {
  const cleanup = () => {
    const directory = process.env.ERROR_LOG_DIR;
    if (!directory) return;
    try {
      const cutoff = Date.parse(new Date().toISOString().slice(0, 10)) - 6 * 86400000;
      for (const name of readdirSync(directory)) {
        if (/^errors-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && Date.parse(name.slice(7, 17)) < cutoff) unlinkSync(join(directory, name));
      }
    } catch { /* Missing directory contains no logs to expire. */ }
  };
  cleanup();
  const timer = setInterval(cleanup, 60 * 60 * 1000);
  timer.unref();
}
