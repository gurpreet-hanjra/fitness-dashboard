import type { AdviceContext, DailyMetricsRow, Env, WorkoutRow } from './types';

const MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct' as const;

function formatWorkoutSummary(w: WorkoutRow): string {
  const parts: string[] = [`Sport: ${w.sport}`, `Date: ${w.started_at}`];
  if (w.duration_sec !== null) parts.push(`Duration: ${Math.round(w.duration_sec / 60)} min`);
  if (w.active_kcal !== null) parts.push(`Active calories: ${w.active_kcal}`);
  if (w.avg_hr !== null) parts.push(`Avg HR: ${w.avg_hr}`);
  if (w.max_hr !== null) parts.push(`Max HR: ${w.max_hr}`);
  if (w.training_load !== null) {
    parts.push(`Training load: ${w.training_load}${w.training_load_label ? ` (${w.training_load_label})` : ''}`);
  }
  if (w.training_effect_aerobic !== null) parts.push(`Aerobic training effect: ${w.training_effect_aerobic}`);
  if (w.training_effect_anaerobic !== null) parts.push(`Anaerobic training effect: ${w.training_effect_anaerobic}`);
  if (w.recovery_hours !== null) parts.push(`Recommended recovery: ${w.recovery_hours}h`);
  if (w.vitality_score !== null) parts.push(`Vitality score: ${w.vitality_score}`);
  return parts.join(', ');
}

function formatRecentMetrics(rows: DailyMetricsRow[]): string {
  if (rows.length === 0) return 'No recent daily metrics recorded.';
  return rows
    .map((r) => {
      const bits: string[] = [r.date];
      if (r.steps !== null) bits.push(`${r.steps} steps`);
      if (r.sleep_duration_min !== null) bits.push(`${(r.sleep_duration_min / 60).toFixed(1)}h sleep`);
      if (r.weight_kg !== null) bits.push(`${r.weight_kg}kg`);
      if (r.avg_hr !== null) bits.push(`avg HR ${r.avg_hr}`);
      if (r.resting_hr !== null) bits.push(`resting HR ${r.resting_hr}`);
      if (r.exercise_minutes !== null) bits.push(`${r.exercise_minutes}min exercise`);
      if (r.active_calories !== null) bits.push(`${r.active_calories} active kcal`);
      return bits.join(', ');
    })
    .join('\n');
}

function formatRecentWorkouts(rows: WorkoutRow[]): string {
  if (rows.length === 0) return 'No other workouts in the past 14 days.';
  return rows
    .map((w) => {
      const bits: string[] = [w.started_at.slice(0, 10), w.sport];
      if (w.training_load !== null) {
        bits.push(`load ${w.training_load}${w.training_load_label ? ` (${w.training_load_label})` : ''}`);
      }
      if (w.recovery_hours !== null) bits.push(`recovery ${w.recovery_hours}h`);
      return bits.join(', ');
    })
    .join('\n');
}

function formatPreviousWorkoutComparison(previousWorkout: WorkoutRow | null): string {
  if (!previousWorkout) {
    return 'There is no previous workout on record -- this is the first tracked workout. Say so explicitly instead of comparing.';
  }
  return `Previous workout for comparison:\n${formatWorkoutSummary(previousWorkout)}`;
}

export function buildPrompt(context: AdviceContext): string {
  return `You are a sports science coach analyzing a field hockey player's workout data. Give deep, practical, structured feedback based on the data below.

Today's workout:
${formatWorkoutSummary(context.workout)}

Daily metrics from the last 14 days (steps, sleep, weight, heart rate):
${formatRecentMetrics(context.recentMetrics)}

Other workouts from the last 14 days:
${formatRecentWorkouts(context.recentWorkouts)}

${formatPreviousWorkoutComparison(context.previousWorkout)}

Structure your response as markdown with exactly these section headers, in this order:

## Analysis
2-3 sentences analyzing this workout's key numbers (load, HR, recovery, vitality) and what they indicate about the athlete's current state.

## Comparison to Previous Workout
Compare this workout to the previous one listed above: what improved, what got worse, and what stayed on track, referencing specific numbers. If there is no previous workout, say this is the first tracked workout instead.

## Action Items

### Recovery
2-3 bullet points (using "- ") of concrete recovery actions for the coming days -- stretching, light activity, sleep, timing before the next high-intensity session -- based on this workout's training load and recovery time, and any accumulated fatigue visible in the recent history.

### Nutrition This Week
3-4 bullet points (using "- ") of general sports-nutrition guidance for the week ahead, appropriate to this training load: hydration, protein/carb timing, training-day vs rest-day calorie needs. Keep this general -- not specific meals or recipes, since we don't track food intake.

Write directly to the athlete in a supportive, practical coaching tone. Do not open with a greeting or a placeholder name (e.g. do not write "Hey [Athlete]") -- start directly with the Analysis section.`;
}

export type AdviceGenerator = (context: AdviceContext, env: Env) => Promise<string>;

export const generateAdvice: AdviceGenerator = async (context, env) => {
  const output = await env.AI.run(MODEL, {
    messages: [{ role: 'user', content: buildPrompt(context) }],
    max_tokens: 1000,
  });

  const text = output.response;
  if (!text || !text.trim()) {
    throw new Error('Empty response from advice model');
  }

  return text.trim();
};
