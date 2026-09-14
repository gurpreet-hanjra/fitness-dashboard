import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../functions/_lib/advice';
import type { AdviceContext, WorkoutRow, DailyMetricsRow } from '../functions/_lib/types';

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

function dailyMetricsRow(overrides: Partial<DailyMetricsRow> = {}): DailyMetricsRow {
  return {
    date: '2026-08-16',
    steps: 8000,
    active_calories: null,
    exercise_minutes: null,
    resting_hr: null,
    avg_hr: 68,
    sleep_duration_min: 420,
    sleep_stages_json: null,
    weight_kg: 82.5,
    body_fat_pct: null,
    updated_at: '2026-08-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildPrompt', () => {
  it('includes the workout sport, training load, and recovery hours', () => {
    const context: AdviceContext = { workout: workoutRow(), recentMetrics: [], recentWorkouts: [] };
    const prompt = buildPrompt(context);
    expect(prompt).toContain('Hockey');
    expect(prompt).toContain('286');
    expect(prompt).toContain('Very high');
    expect(prompt).toContain('72');
  });

  it('includes recent daily metrics data', () => {
    const context: AdviceContext = {
      workout: workoutRow(),
      recentMetrics: [
        dailyMetricsRow({ date: '2026-08-16', steps: 9500, weight_kg: 83.1, resting_hr: 55 }),
      ],
      recentWorkouts: [],
    };
    const prompt = buildPrompt(context);
    expect(prompt).toContain('2026-08-16');
    expect(prompt).toContain('9500');
    expect(prompt).toContain('83.1');
    expect(prompt).toContain('55');
  });

  it('includes prior workouts data', () => {
    const context: AdviceContext = {
      workout: workoutRow(),
      recentMetrics: [],
      recentWorkouts: [workoutRow({ started_at: '2026-08-10T18:00:00', training_load: 150, training_load_label: 'Moderate' })],
    };
    const prompt = buildPrompt(context);
    expect(prompt).toContain('2026-08-10');
    expect(prompt).toContain('150');
    expect(prompt).toContain('Moderate');
  });

  it('says so explicitly when there is no recent history', () => {
    const context: AdviceContext = { workout: workoutRow(), recentMetrics: [], recentWorkouts: [] };
    const prompt = buildPrompt(context);
    expect(prompt).toContain('No recent daily metrics recorded.');
    expect(prompt).toContain('No other workouts in the past 14 days.');
  });

  it('instructs the model not to use a placeholder greeting', () => {
    const context: AdviceContext = { workout: workoutRow(), recentMetrics: [], recentWorkouts: [] };
    const prompt = buildPrompt(context);
    expect(prompt).toContain('Hey [Athlete]');
  });
});
