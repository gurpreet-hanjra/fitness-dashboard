import type { D1Like, DailyMetricsRow, Goal } from './types';

const UPSERT_SQL = `
  INSERT INTO daily_metrics (
    date, steps, active_calories, exercise_minutes, resting_hr, avg_hr,
    sleep_duration_min, sleep_stages_json, weight_kg, body_fat_pct, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    steps = COALESCE(excluded.steps, daily_metrics.steps),
    active_calories = COALESCE(excluded.active_calories, daily_metrics.active_calories),
    exercise_minutes = COALESCE(excluded.exercise_minutes, daily_metrics.exercise_minutes),
    resting_hr = COALESCE(excluded.resting_hr, daily_metrics.resting_hr),
    avg_hr = COALESCE(excluded.avg_hr, daily_metrics.avg_hr),
    sleep_duration_min = COALESCE(excluded.sleep_duration_min, daily_metrics.sleep_duration_min),
    sleep_stages_json = COALESCE(excluded.sleep_stages_json, daily_metrics.sleep_stages_json),
    weight_kg = COALESCE(excluded.weight_kg, daily_metrics.weight_kg),
    body_fat_pct = COALESCE(excluded.body_fat_pct, daily_metrics.body_fat_pct),
    updated_at = excluded.updated_at
`;

export async function upsertDailyMetrics(db: D1Like, rows: DailyMetricsRow[]): Promise<void> {
  for (const row of rows) {
    await db
      .prepare(UPSERT_SQL)
      .bind(
        row.date,
        row.steps,
        row.active_calories,
        row.exercise_minutes,
        row.resting_hr,
        row.avg_hr,
        row.sleep_duration_min,
        row.sleep_stages_json,
        row.weight_kg,
        row.body_fat_pct,
        row.updated_at
      )
      .run();
  }
}

export async function queryMetricsRange(db: D1Like, from: string, to: string): Promise<DailyMetricsRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM daily_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC')
    .bind(from, to)
    .all<DailyMetricsRow>();
  return results;
}

export async function getGoal(db: D1Like, metric: string): Promise<Goal | null> {
  return db.prepare('SELECT * FROM goals WHERE metric = ?').bind(metric).first<Goal>();
}

export async function setGoal(db: D1Like, metric: string, target: number, setAt: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO goals (metric, target, set_at) VALUES (?, ?, ?)
       ON CONFLICT(metric) DO UPDATE SET target = excluded.target, set_at = excluded.set_at`
    )
    .bind(metric, target, setAt)
    .run();
}
