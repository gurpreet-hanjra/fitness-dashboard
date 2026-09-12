import { describe, it, expect, beforeEach } from 'vitest';
import { upsertDailyMetrics, queryMetricsRange, getGoal, setGoal } from '../functions/_lib/db';
import { createTestDb } from './helpers';
import type { D1Like, DailyMetricsRow } from '../functions/_lib/types';

function emptyRow(date: string): DailyMetricsRow {
  return {
    date,
    steps: null,
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

describe('daily_metrics upsert/query', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts a new row', async () => {
    await upsertDailyMetrics(db, [{ ...emptyRow('2026-09-01'), steps: 8000 }]);
    const rows = await queryMetricsRange(db, '2026-09-01', '2026-09-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBe(8000);
  });

  it('overwrites a field when a later payload provides a new value for the same date', async () => {
    await upsertDailyMetrics(db, [{ ...emptyRow('2026-09-01'), steps: 8000 }]);
    await upsertDailyMetrics(db, [{ ...emptyRow('2026-09-01'), steps: 9000 }]);
    const rows = await queryMetricsRange(db, '2026-09-01', '2026-09-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBe(9000);
  });

  it('merges a partial payload without wiping fields set by an earlier payload', async () => {
    await upsertDailyMetrics(db, [{ ...emptyRow('2026-09-01'), steps: 8000 }]);
    await upsertDailyMetrics(db, [{ ...emptyRow('2026-09-01'), weight_kg: 82.3 }]);
    const rows = await queryMetricsRange(db, '2026-09-01', '2026-09-01');
    expect(rows[0].steps).toBe(8000);
    expect(rows[0].weight_kg).toBe(82.3);
  });

  it('filters by date range', async () => {
    await upsertDailyMetrics(db, [emptyRow('2026-08-01'), emptyRow('2026-09-01'), emptyRow('2026-09-15')]);
    const rows = await queryMetricsRange(db, '2026-09-01', '2026-09-30');
    expect(rows.map((r) => r.date)).toEqual(['2026-09-01', '2026-09-15']);
  });

  it('returns an empty array for a range with no data', async () => {
    const rows = await queryMetricsRange(db, '2020-01-01', '2020-01-31');
    expect(rows).toEqual([]);
  });

  it('persists a batch larger than the internal chunk size (multi-chunk path)', async () => {
    const rowCount = 62;
    const rows: DailyMetricsRow[] = Array.from({ length: rowCount }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = i < 28 ? '08' : i < 56 ? '09' : '10';
      return { ...emptyRow(`2026-${month}-${day}`), steps: 1000 + i };
    });

    await upsertDailyMetrics(db, rows);

    const stored = await queryMetricsRange(db, '2026-08-01', '2026-10-31');
    expect(stored).toHaveLength(rowCount);
    const byDate = new Map(stored.map((r) => [r.date, r]));
    for (const row of rows) {
      expect(byDate.get(row.date)?.steps).toBe(row.steps);
    }
  });
});

describe('goals', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns null when no goal is set', async () => {
    expect(await getGoal(db, 'weight_kg')).toBeNull();
  });

  it('sets and retrieves a goal', async () => {
    await setGoal(db, 'weight_kg', 75, '2026-09-01T00:00:00.000Z');
    const goal = await getGoal(db, 'weight_kg');
    expect(goal).toMatchObject({ metric: 'weight_kg', target: 75 });
  });

  it('overwrites an existing goal for the same metric', async () => {
    await setGoal(db, 'weight_kg', 75, '2026-09-01T00:00:00.000Z');
    await setGoal(db, 'weight_kg', 73, '2026-09-05T00:00:00.000Z');
    const goal = await getGoal(db, 'weight_kg');
    expect(goal?.target).toBe(73);
  });
});
