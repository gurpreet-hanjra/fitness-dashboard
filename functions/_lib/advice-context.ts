import type { D1Like, WorkoutRow, AdviceContext } from './types';
import { queryMetricsRange } from './db';
import { queryWorkoutsRange } from './workouts-db';

const CONTEXT_WINDOW_DAYS = 14;

export async function buildAdviceContext(db: D1Like, workout: WorkoutRow): Promise<AdviceContext> {
  const to = workout.started_at.slice(0, 10);
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - CONTEXT_WINDOW_DAYS);
  const from = fromDate.toISOString().slice(0, 10);

  const [recentMetrics, workoutsInWindow] = await Promise.all([
    queryMetricsRange(db, from, to),
    queryWorkoutsRange(db, from, to),
  ]);

  const recentWorkouts = workoutsInWindow.filter((w) => w.started_at !== workout.started_at);

  return { workout, recentMetrics, recentWorkouts };
}
