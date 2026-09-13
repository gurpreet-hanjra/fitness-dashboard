import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet } from '../functions/api/workouts';
import { upsertWorkout } from '../functions/_lib/workouts-db';
import { createTestDb, makeEnv, makeRequest } from './helpers';
import type { D1Like, WorkoutRow } from '../functions/_lib/types';

function row(startedAt: string): WorkoutRow {
  return {
    started_at: startedAt,
    sport: 'Hockey',
    duration_sec: 8333,
    active_kcal: 697,
    total_kcal: 935,
    avg_hr: 133,
    max_hr: 185,
    hr_zones_json: null,
    training_effect_aerobic: 5.0,
    training_effect_anaerobic: 2.2,
    training_load: 286,
    training_load_label: 'Very high',
    recovery_hours: 72,
    vitality_score: 64,
    source_device: 'Xiaomi Smart Band 10',
    image_key: null,
    created_at: '2026-08-17T22:00:00.000Z',
  };
}

describe('GET /api/workouts', () => {
  let db: D1Like;

  beforeEach(async () => {
    db = createTestDb();
    await upsertWorkout(db, row('2026-08-05T18:00:00'));
    await upsertWorkout(db, row('2026-08-17T20:03:14'));
  });

  it('requires from and to query params', async () => {
    const response = await onRequestGet({ request: makeRequest('https://x/api/workouts'), env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('rejects malformed date params', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts?from=not-a-date&to=2026-08-31'),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(400);
  });

  it('returns workouts within the requested range, most recent first', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts?from=2026-08-01&to=2026-08-31'),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(200);
    const rows = (await response.json()) as WorkoutRow[];
    expect(rows).toHaveLength(2);
    expect(rows[0].started_at).toBe('2026-08-17T20:03:14');
  });

  it('returns an empty array when nothing is in range', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts?from=2020-01-01&to=2020-01-31'),
      env: makeEnv(db),
    } as any);
    const rows = await response.json();
    expect(rows).toEqual([]);
  });
});
