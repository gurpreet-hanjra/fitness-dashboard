import { describe, it, expect } from 'vitest';
import { normalizeExtractedWorkout } from '../functions/_lib/workout-parse';
import type { ExtractedWorkout } from '../functions/_lib/types';

const FULL_EXTRACTION: ExtractedWorkout = {
  started_at: '2026-08-17T20:03:14',
  sport: 'Hockey',
  duration_sec: 8333,
  active_kcal: 697,
  total_kcal: 935,
  avg_hr: 133,
  max_hr: 185,
  hr_zones: {
    light_sec: 1132,
    intensive_sec: 2060,
    aerobic_sec: 890,
    anaerobic_sec: 2413,
    vo2max_sec: 1209,
  },
  training_effect_aerobic: 5.0,
  training_effect_anaerobic: 2.2,
  training_load: 286,
  training_load_label: 'Very high',
  recovery_hours: 72,
  vitality_score: 64,
  source_device: 'Xiaomi Smart Band 10',
};

describe('normalizeExtractedWorkout', () => {
  it('returns null when started_at is missing', () => {
    const { started_at, ...rest } = FULL_EXTRACTION;
    expect(normalizeExtractedWorkout(rest, '2026-08-17T22:00:00.000Z')).toBeNull();
  });

  it('returns null when sport is missing', () => {
    const { sport, ...rest } = FULL_EXTRACTION;
    expect(normalizeExtractedWorkout(rest, '2026-08-17T22:00:00.000Z')).toBeNull();
  });

  it('maps a full extraction to a WorkoutRow, stringifying hr_zones', () => {
    const row = normalizeExtractedWorkout(FULL_EXTRACTION, '2026-08-17T22:00:00.000Z');
    expect(row).not.toBeNull();
    expect(row?.started_at).toBe('2026-08-17T20:03:14');
    expect(row?.sport).toBe('Hockey');
    expect(row?.training_load).toBe(286);
    expect(row?.training_load_label).toBe('Very high');
    expect(row?.recovery_hours).toBe(72);
    expect(row?.vitality_score).toBe(64);
    expect(row?.created_at).toBe('2026-08-17T22:00:00.000Z');
    expect(JSON.parse(row?.hr_zones_json as string)).toEqual({
      light_sec: 1132,
      intensive_sec: 2060,
      aerobic_sec: 890,
      anaerobic_sec: 2413,
      vo2max_sec: 1209,
    });
  });

  it('sets hr_zones_json to null when hr_zones is absent', () => {
    const { hr_zones, ...rest } = FULL_EXTRACTION;
    const row = normalizeExtractedWorkout(rest, '2026-08-17T22:00:00.000Z');
    expect(row?.hr_zones_json).toBeNull();
  });

  it('defaults missing optional numeric/string fields to null', () => {
    const row = normalizeExtractedWorkout(
      { started_at: '2026-08-17T20:03:14', sport: 'Hockey' },
      '2026-08-17T22:00:00.000Z'
    );
    expect(row).toEqual({
      started_at: '2026-08-17T20:03:14',
      sport: 'Hockey',
      duration_sec: null,
      active_kcal: null,
      total_kcal: null,
      avg_hr: null,
      max_hr: null,
      hr_zones_json: null,
      training_effect_aerobic: null,
      training_effect_anaerobic: null,
      training_load: null,
      training_load_label: null,
      recovery_hours: null,
      vitality_score: null,
      source_device: null,
      image_key: null,
      advice: null,
      created_at: '2026-08-17T22:00:00.000Z',
    });
  });

  it('defensively treats a non-number value in a numeric field as null', () => {
    const row = normalizeExtractedWorkout(
      { ...FULL_EXTRACTION, training_load: 'a lot' as unknown as number },
      '2026-08-17T22:00:00.000Z'
    );
    expect(row?.training_load).toBeNull();
  });
});
