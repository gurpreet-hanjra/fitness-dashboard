import type { ExtractedWorkout, WorkoutRow } from './types';

export function normalizeExtractedWorkout(extracted: ExtractedWorkout, nowIso: string): WorkoutRow | null {
  if (!extracted.started_at || !extracted.sport) {
    return null;
  }

  return {
    started_at: extracted.started_at,
    sport: extracted.sport,
    duration_sec: numberOrNull(extracted.duration_sec),
    active_kcal: numberOrNull(extracted.active_kcal),
    total_kcal: numberOrNull(extracted.total_kcal),
    avg_hr: numberOrNull(extracted.avg_hr),
    max_hr: numberOrNull(extracted.max_hr),
    hr_zones_json: extracted.hr_zones ? JSON.stringify(extracted.hr_zones) : null,
    training_effect_aerobic: numberOrNull(extracted.training_effect_aerobic),
    training_effect_anaerobic: numberOrNull(extracted.training_effect_anaerobic),
    training_load: numberOrNull(extracted.training_load),
    training_load_label: stringOrNull(extracted.training_load_label),
    recovery_hours: numberOrNull(extracted.recovery_hours),
    vitality_score: numberOrNull(extracted.vitality_score),
    source_device: stringOrNull(extracted.source_device),
    // Not part of AI extraction -- set by the ingest handler after a
    // successful R2 upload of the source image (functions/_lib/image-store.ts).
    image_key: null,
    // Not part of initial extraction -- set later by the advice endpoint (Tasks 2-4).
    advice: null,
    created_at: nowIso,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
