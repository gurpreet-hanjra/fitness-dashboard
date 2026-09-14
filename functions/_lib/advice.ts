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

export function buildPrompt(context: AdviceContext): string {
  return `You are a sports science coach analyzing a hockey player's workout data. Give concise, practical advice based on the data below.

Today's workout:
${formatWorkoutSummary(context.workout)}

Daily metrics from the last 14 days (steps, sleep, weight, heart rate):
${formatRecentMetrics(context.recentMetrics)}

Other workouts from the last 14 days:
${formatRecentWorkouts(context.recentWorkouts)}

Write about 150-300 words of practical advice covering:
1. Recovery guidance based on this workout's training load and recovery time, and any accumulated fatigue visible in the recent history.
2. Suggestions for the next training session (intensity, timing, what to focus on).
3. General sports-nutrition guidance appropriate to this training load (not personalized to specific meals, since we don't track food intake -- general guidance like hydration, protein/carb timing is fine).

Write directly to the athlete in a supportive, practical coaching tone. Do not use markdown formatting, just plain prose in paragraphs.`;
}

export type AdviceGenerator = (context: AdviceContext, env: Env) => Promise<string>;

export const generateAdvice: AdviceGenerator = async (context, env) => {
  const output = await env.AI.run(MODEL, {
    messages: [{ role: 'user', content: buildPrompt(context) }],
    max_tokens: 700,
  });

  const text = output.response;
  if (!text || !text.trim()) {
    throw new Error('Empty response from advice model');
  }

  return text.trim();
};
