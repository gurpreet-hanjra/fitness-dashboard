import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet } from '../functions/api/metrics';
import { upsertDailyMetrics } from '../functions/_lib/db';
import { createTestDb, makeEnv, makeRequest } from './helpers';
import type { D1Like, DailyMetricsRow } from '../functions/_lib/types';

function row(date: string, steps: number): DailyMetricsRow {
  return {
    date,
    steps,
    active_calories: null,
    exercise_minutes: null,
    resting_hr: null,
    avg_hr: null,
    sleep_duration_min: null,
    sleep_stages_json: null,
    weight_kg: null,
    body_fat_pct: null,
    updated_at: '2026-09-01T00:00:00.000Z',
  };
}

describe('GET /api/metrics', () => {
  let db: D1Like;

  beforeEach(async () => {
    db = createTestDb();
    await upsertDailyMetrics(db, [row('2026-09-01', 1000), row('2026-09-02', 2000), row('2026-09-10', 3000)]);
  });

  it('requires from and to query params', async () => {
    const response = await onRequestGet({ request: makeRequest('https://x/api/metrics'), env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('rejects malformed date params', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/metrics?from=not-a-date&to=2026-09-02'),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(400);
  });

  it('returns rows within the requested range', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/metrics?from=2026-09-01&to=2026-09-02'),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(200);
    const rows = (await response.json()) as DailyMetricsRow[];
    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBe('2026-09-01');
  });

  it('returns an empty array when nothing is in range', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/metrics?from=2020-01-01&to=2020-01-31'),
      env: makeEnv(db),
    } as any);
    const rows = await response.json();
    expect(rows).toEqual([]);
  });
});
