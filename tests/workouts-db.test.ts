import { describe, it, expect, beforeEach } from 'vitest';
import { upsertWorkout, queryWorkoutsRange } from '../functions/_lib/workouts-db';
import { createTestDb } from './helpers';
import type { D1Like, WorkoutRow } from '../functions/_lib/types';

function row(overrides: Partial<WorkoutRow> = {}): WorkoutRow {
  return {
    started_at: '2026-08-17T20:03:14',
    sport: 'Hockey',
    duration_sec: 8333,
    active_kcal: 697,
    total_kcal: 935,
    avg_hr: 133,
    max_hr: 185,
    hr_zones_json: JSON.stringify({
      light_sec: 1132,
      intensive_sec: 2060,
      aerobic_sec: 890,
      anaerobic_sec: 2413,
      vo2max_sec: 1209,
    }),
    training_effect_aerobic: 5.0,
    training_effect_anaerobic: 2.2,
    training_load: 286,
    training_load_label: 'Very high',
    recovery_hours: 72,
    vitality_score: 64,
    source_device: 'Xiaomi Smart Band 10',
    created_at: '2026-08-17T22:00:00.000Z',
    ...overrides,
  };
}

describe('workouts upsert/query', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts a new workout', async () => {
    await upsertWorkout(db, row());
    const rows = await queryWorkoutsRange(db, '2026-08-01', '2026-08-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].sport).toBe('Hockey');
    expect(rows[0].training_load).toBe(286);
  });

  it('upserts (replaces) on the same started_at instead of duplicating', async () => {
    await upsertWorkout(db, row());
    await upsertWorkout(db, row({ training_load: 300, training_load_label: 'Extreme' }));
    const rows = await queryWorkoutsRange(db, '2026-08-01', '2026-08-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].training_load).toBe(300);
    expect(rows[0].training_load_label).toBe('Extreme');
  });

  it('filters by the date portion of started_at', async () => {
    await upsertWorkout(db, row({ started_at: '2026-07-15T18:00:00' }));
    await upsertWorkout(db, row({ started_at: '2026-08-17T20:03:14' }));
    await upsertWorkout(db, row({ started_at: '2026-09-01T19:00:00' }));
    const rows = await queryWorkoutsRange(db, '2026-08-01', '2026-08-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].started_at).toBe('2026-08-17T20:03:14');
  });

  it('orders results most-recent-first', async () => {
    await upsertWorkout(db, row({ started_at: '2026-08-01T18:00:00' }));
    await upsertWorkout(db, row({ started_at: '2026-08-20T18:00:00' }));
    await upsertWorkout(db, row({ started_at: '2026-08-10T18:00:00' }));
    const rows = await queryWorkoutsRange(db, '2026-08-01', '2026-08-31');
    expect(rows.map((r) => r.started_at)).toEqual([
      '2026-08-20T18:00:00',
      '2026-08-10T18:00:00',
      '2026-08-01T18:00:00',
    ]);
  });

  it('returns an empty array for a range with no workouts', async () => {
    const rows = await queryWorkoutsRange(db, '2020-01-01', '2020-01-31');
    expect(rows).toEqual([]);
  });
});
