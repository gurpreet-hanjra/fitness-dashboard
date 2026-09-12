import type { DailyMetricsRow } from './types';

export class PayloadError extends Error {}

interface HealthAutoExportPayload {
  data?: {
    metrics?: Array<{
      name?: string;
      data?: Array<Record<string, unknown>>;
    }>;
  };
}

const METRIC = {
  STEPS: 'step_count',
  ACTIVE_ENERGY: 'active_energy',
  EXERCISE_TIME: 'apple_exercise_time',
  HEART_RATE: 'heart_rate',
  RESTING_HR: 'resting_heart_rate',
  WEIGHT: 'weight_body_mass',
  BODY_FAT: 'body_fat_percentage',
  SLEEP: 'sleep_analysis',
} as const;

export function parsePayload(json: unknown): DailyMetricsRow[] {
  const payload = json as HealthAutoExportPayload;
  const metrics = payload?.data?.metrics;
  if (!Array.isArray(metrics)) {
    throw new PayloadError('Missing data.metrics array');
  }

  const rowsByDate = new Map<string, DailyMetricsRow>();
  const now = new Date().toISOString();

  const getRow = (date: string): DailyMetricsRow => {
    let row = rowsByDate.get(date);
    if (!row) {
      row = {
        date,
        steps: null,
        active_calories: null,
        exercise_minutes: null,
        resting_hr: null,
        avg_hr: null,
        sleep_duration_min: null,
        sleep_stages_json: null,
        weight_kg: null,
        body_fat_pct: null,
        updated_at: now,
      };
      rowsByDate.set(date, row);
    }
    return row;
  };

  for (const metric of metrics) {
    if (!metric || typeof metric.name !== 'string' || !Array.isArray(metric.data)) {
      throw new PayloadError('Each metric requires a name and a data array');
    }
    for (const point of metric.data) {
      const date = extractDate(point?.date);
      const row = getRow(date);
      switch (metric.name) {
        case METRIC.STEPS:
          row.steps = numberOrNull(point.qty);
          break;
        case METRIC.ACTIVE_ENERGY:
          row.active_calories = numberOrNull(point.qty);
          break;
        case METRIC.EXERCISE_TIME:
          row.exercise_minutes = numberOrNull(point.qty);
          break;
        case METRIC.HEART_RATE:
          row.avg_hr = numberOrNull(point.Avg);
          break;
        case METRIC.RESTING_HR:
          row.resting_hr = numberOrNull(point.qty);
          break;
        case METRIC.WEIGHT:
          row.weight_kg = numberOrNull(point.qty);
          break;
        case METRIC.BODY_FAT:
          row.body_fat_pct = numberOrNull(point.qty);
          break;
        case METRIC.SLEEP: {
          const asleepHours = numberOrNull(point.asleep);
          row.sleep_duration_min = asleepHours !== null ? Math.round(asleepHours * 60) : null;
          row.sleep_stages_json = JSON.stringify({
            deep: minutesOrNull(point.deep),
            rem: minutesOrNull(point.rem),
            core: minutesOrNull(point.core),
            awake: minutesOrNull(point.awake),
          });
          break;
        }
        default:
          break; // unrecognized metric — not tracked in v1
      }
    }
  }

  return Array.from(rowsByDate.values());
}

function extractDate(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10) {
    throw new PayloadError(`Invalid or missing date: ${JSON.stringify(value)}`);
  }
  return value.slice(0, 10);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function minutesOrNull(value: unknown): number | null {
  const hours = numberOrNull(value);
  return hours !== null ? Math.round(hours * 60) : null;
}
