import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Analytics, berlinDay } from '../dist/analytics/Analytics.js';
import { createHttpApp } from '../dist/http/createHttpApp.js';
import { logError, startLogCleanup } from '../dist/logging/logger.js';

test('error logs expire at startup and contain only safe fields', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tickweave-errors-'));
  const previous = process.env.ERROR_LOG_DIR;
  process.env.ERROR_LOG_DIR = directory;
  try {
    writeFileSync(join(directory, 'errors-2000-01-01.jsonl'), 'old');
    startLogCleanup();
    assert.equal(readdirSync(directory).length, 0);
    logError('HISTORY_FAILED', 'random-request-id');
    const entry = JSON.parse(readFileSync(join(directory, readdirSync(directory)[0]), 'utf8'));
    assert.deepEqual(Object.keys(entry).sort(), ['code', 'level', 'requestId', 'time']);
  } finally {
    if (previous === undefined) delete process.env.ERROR_LOG_DIR;
    else process.env.ERROR_LOG_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Berlin date observes midnight and DST', () => {
  assert.equal(berlinDay(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
  assert.equal(berlinDay(new Date('2026-01-01T22:30:00Z')), '2026-01-01');
});

test('persistent counters, retention, protected API and private aggregation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tickweave-analytics-'));
  const path = join(directory, 'stats.sqlite');
  let analytics = new Analytics(path);
  analytics.record('page', '/');
  analytics.close();
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO totals VALUES (?, ?, ?, ?, ?, ?, ?)').run('2000-01-01', 'page', '/', '', 0, 1, 0);
  db.close();
  analytics = new Analytics(path);
  const app = createHttpApp({ analytics, getCandleBuffer: () => undefined });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const previous = process.env.ANALYTICS_ADMIN_TOKEN;
  try {
    delete process.env.ANALYTICS_ADMIN_TOKEN;
    assert.equal((await fetch(base + '/api/admin/stats')).status, 503);
    process.env.ANALYTICS_ADMIN_TOKEN = 'a'.repeat(32);
    assert.equal((await fetch(base + '/api/admin/stats')).status, 401);
    const headers = { authorization: `Bearer ${process.env.ANALYTICS_ADMIN_TOKEN}` };
    assert.equal((await fetch(base + '/api/admin/stats?date=2026-02-30', { headers })).status, 400);
    assert.equal((await fetch(base + '/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"page":"/education"}' })).status, 204);
    assert.equal((await fetch(base + '/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"page":"/alice@example.com"}' })).status, 400);
    await fetch(base + '/api/markets/private-email/candles?token=super-secret');
    await fetch(base + '/unknown-secret?token=super-secret');
    await fetch(base + '/api/health');
    const result = await (await fetch(base + '/api/admin/stats', { headers })).json();
    assert.equal(result.pageviews, 2);
    assert.equal(result.requests.length, 2);
    assert.ok(result.requests.some(row => row.route === '/api/markets/:marketId/candles' && row.count === 1));
    assert.ok(result.requests.some(row => row.route === 'unmatched'));
    assert.ok(!JSON.stringify(result).includes('secret'));
    assert.equal(analytics.summary('2000-01-01').pageviews, 0);
  } finally {
    if (previous === undefined) delete process.env.ANALYTICS_ADMIN_TOKEN;
    else process.env.ANALYTICS_ADMIN_TOKEN = previous;
    await new Promise(resolve => server.close(resolve));
    analytics.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
