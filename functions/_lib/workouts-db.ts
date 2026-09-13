import type { D1Like, WorkoutRow } from './types';

const UPSERT_SQL = `
  INSERT INTO workouts (
    started_at, sport, duration_sec, active_kcal, total_kcal, avg_hr, max_hr,
    hr_zones_json, training_effect_aerobic, training_effect_anaerobic,
    training_load, training_load_label, recovery_hours, vitality_score,
    source_device, image_key, advice, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(started_at) DO UPDATE SET
    sport = excluded.sport,
    duration_sec = excluded.duration_sec,
    active_kcal = excluded.active_kcal,
    total_kcal = excluded.total_kcal,
    avg_hr = excluded.avg_hr,
    max_hr = excluded.max_hr,
    hr_zones_json = excluded.hr_zones_json,
    training_effect_aerobic = excluded.training_effect_aerobic,
    training_effect_anaerobic = excluded.training_effect_anaerobic,
    training_load = excluded.training_load,
    training_load_label = excluded.training_load_label,
    recovery_hours = excluded.recovery_hours,
    vitality_score = excluded.vitality_score,
    source_device = excluded.source_device,
    image_key = excluded.image_key,
    advice = excluded.advice,
    created_at = excluded.created_at
`;

export async function upsertWorkout(db: D1Like, row: WorkoutRow): Promise<void> {
  await db
    .prepare(UPSERT_SQL)
    .bind(
      row.started_at,
      row.sport,
      row.duration_sec,
      row.active_kcal,
      row.total_kcal,
      row.avg_hr,
      row.max_hr,
      row.hr_zones_json,
      row.training_effect_aerobic,
      row.training_effect_anaerobic,
      row.training_load,
      row.training_load_label,
      row.recovery_hours,
      row.vitality_score,
      row.source_device,
      row.image_key,
      row.advice,
      row.created_at
    )
    .run();
}

export async function queryWorkoutsRange(db: D1Like, from: string, to: string): Promise<WorkoutRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM workouts WHERE date(started_at) >= ? AND date(started_at) <= ? ORDER BY started_at DESC')
    .bind(from, to)
    .all<WorkoutRow>();
  return results;
}
