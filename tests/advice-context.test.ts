import { describe, it, expect, beforeEach } from 'vitest';
import { buildAdviceContext } from '../functions/_lib/advice-context';
import { upsertWorkout } from '../functions/_lib/workouts-db';
import { createTestDb } from './helpers';
import type { D1Like, WorkoutRow } from '../functions/_lib/types';

function workoutRow(overrides: Partial<WorkoutRow> = {}): WorkoutRow {
  return {
    started_at: '2026-08-17T20:03:14',
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
    advice: null,
    created_at: '2026-08-17T22:00:00.000Z',
    ...overrides,
  };
}

async function insertDailyMetric(db: D1Like, date: string, steps: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO daily_metrics (date, steps, active_calories, exercise_minutes, resting_hr, avg_hr, sleep_duration_min, sleep_stages_json, weight_kg, body_fat_pct, updated_at) VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`
    )
    .bind(date, steps, `${date}T00:00:00.000Z`)
    .run();
}

describe('buildAdviceContext', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('includes daily_metrics from the 14 days ending on the workout date, excluding older ones', async () => {
    await insertDailyMetric(db, '2026-08-10', 8000); // within 14 days of 2026-08-17
    await insertDailyMetric(db, '2026-07-01', 5000); // outside the window

    const context = await buildAdviceContext(db, workoutRow());
    const dates = context.recentMetrics.map((m) => m.date);
    expect(dates).toContain('2026-08-10');
    expect(dates).not.toContain('2026-07-01');
  });

  it('includes daily_metrics at the 14-day boundary (13 days back inclusive, 14 days back exclusive)', async () => {
    await insertDailyMetric(db, '2026-08-04', 8000); // 13 days before 2026-08-17, should be included
    await insertDailyMetric(db, '2026-08-03', 5000); // 14 days before 2026-08-17, should be excluded

    const context = await buildAdviceContext(db, workoutRow({ started_at: '2026-08-17T20:03:14' }));
    const dates = context.recentMetrics.map((m) => m.date);
    expect(dates).toContain('2026-08-04');
    expect(dates).not.toContain('2026-08-03');
  });

  it('includes prior workouts within the window but excludes the workout itself', async () => {
    await upsertWorkout(db, workoutRow({ started_at: '2026-08-10T18:00:00', training_load: 200 }));

    const workout = workoutRow({ started_at: '2026-08-17T20:03:14', training_load: 286 });
    await upsertWorkout(db, workout);
    const context = await buildAdviceContext(db, workout);

    expect(context.recentWorkouts).toHaveLength(1);
    expect(context.recentWorkouts[0].started_at).toBe('2026-08-10T18:00:00');
    expect(context.recentWorkouts.some((w) => w.started_at === workout.started_at)).toBe(false);
  });

  it('excludes workouts older than 14 days before the workout date', async () => {
    await upsertWorkout(db, workoutRow({ started_at: '2026-07-01T18:00:00', training_load: 100 }));

    const context = await buildAdviceContext(db, workoutRow({ started_at: '2026-08-17T20:03:14' }));
    expect(context.recentWorkouts).toHaveLength(0);
  });

  it('returns empty arrays when there is no prior history', async () => {
    const context = await buildAdviceContext(db, workoutRow());
    expect(context.recentMetrics).toEqual([]);
    expect(context.recentWorkouts).toEqual([]);
  });

  it('includes the passed-in workout unchanged on the context', async () => {
    const workout = workoutRow();
    const context = await buildAdviceContext(db, workout);
    expect(context.workout).toEqual(workout);
  });

  it('sets previousWorkout to the most recent prior workout in the window', async () => {
    await upsertWorkout(db, workoutRow({ started_at: '2026-08-10T18:00:00', training_load: 200 }));
    await upsertWorkout(db, workoutRow({ started_at: '2026-08-14T18:00:00', training_load: 150 }));

    const workout = workoutRow({ started_at: '2026-08-17T20:03:14', training_load: 286 });
    await upsertWorkout(db, workout);
    const context = await buildAdviceContext(db, workout);

    expect(context.previousWorkout?.started_at).toBe('2026-08-14T18:00:00');
  });

  it('sets previousWorkout to null when there is no prior workout in the window', async () => {
    const context = await buildAdviceContext(db, workoutRow());
    expect(context.previousWorkout).toBeNull();
  });
});
