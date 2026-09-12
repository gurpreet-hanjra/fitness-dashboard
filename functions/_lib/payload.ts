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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per-date accumulator tracking enough state to correctly implement
 * sum / mean / last-non-null aggregation across multiple data points
 * for the same metric on the same date within one payload.
 */
interface Accumulator {
  date: string;
  updatedAt: string;

  stepsSum: number;
  stepsSeen: boolean;

  activeCaloriesSum: number;
  activeCaloriesSeen: boolean;

  exerciseMinutesSum: number;
  exerciseMinutesSeen: boolean;

  hrSum: number;
  hrCount: number;

  restingHrLast: number | null;
  restingHrSeen: boolean;

  weightLast: number | null;
  weightSeen: boolean;

  bodyFatLast: number | null;
  bodyFatSeen: boolean;

  sleepAsleepHoursSum: number;
  sleepAsleepSeen: boolean;

  sleepDeepSum: number;
  sleepDeepSeen: boolean;

  sleepRemSum: number;
  sleepRemSeen: boolean;

  sleepCoreSum: number;
  sleepCoreSeen: boolean;

  sleepAwakeSum: number;
  sleepAwakeSeen: boolean;
}

function newAccumulator(date: string, updatedAt: string): Accumulator {
  return {
    date,
    updatedAt,
    stepsSum: 0,
    stepsSeen: false,
    activeCaloriesSum: 0,
    activeCaloriesSeen: false,
    exerciseMinutesSum: 0,
    exerciseMinutesSeen: false,
    hrSum: 0,
    hrCount: 0,
    restingHrLast: null,
    restingHrSeen: false,
    weightLast: null,
    weightSeen: false,
    bodyFatLast: null,
    bodyFatSeen: false,
    sleepAsleepHoursSum: 0,
    sleepAsleepSeen: false,
    sleepDeepSum: 0,
    sleepDeepSeen: false,
    sleepRemSum: 0,
    sleepRemSeen: false,
    sleepCoreSum: 0,
    sleepCoreSeen: false,
    sleepAwakeSum: 0,
    sleepAwakeSeen: false,
  };
}

export function parsePayload(json: unknown): DailyMetricsRow[] {
  const payload = json as HealthAutoExportPayload;
  const metrics = payload?.data?.metrics;
  if (!Array.isArray(metrics)) {
    throw new PayloadError('Missing data.metrics array');
  }

  const accumulatorsByDate = new Map<string, Accumulator>();
  const now = new Date().toISOString();

  const getAccumulator = (date: string): Accumulator => {
    let acc = accumulatorsByDate.get(date);
    if (!acc) {
      acc = newAccumulator(date, now);
      accumulatorsByDate.set(date, acc);
    }
    return acc;
  };

  for (const metric of metrics) {
    if (!metric || typeof metric.name !== 'string' || !Array.isArray(metric.data)) {
      throw new PayloadError('Each metric requires a name and a data array');
    }
    for (const point of metric.data) {
      const date = extractDate(point?.date);
      const acc = getAccumulator(date);
      switch (metric.name) {
        case METRIC.STEPS: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.stepsSum += value;
            acc.stepsSeen = true;
          }
          break;
        }
        case METRIC.ACTIVE_ENERGY: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.activeCaloriesSum += value;
            acc.activeCaloriesSeen = true;
          }
          break;
        }
        case METRIC.EXERCISE_TIME: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.exerciseMinutesSum += value;
            acc.exerciseMinutesSeen = true;
          }
          break;
        }
        case METRIC.HEART_RATE: {
          const value = numberOrNull(point.Avg);
          if (value !== null) {
            acc.hrSum += value;
            acc.hrCount += 1;
          }
          break;
        }
        case METRIC.RESTING_HR: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.restingHrLast = value;
            acc.restingHrSeen = true;
          }
          break;
        }
        case METRIC.WEIGHT: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.weightLast = value;
            acc.weightSeen = true;
          }
          break;
        }
        case METRIC.BODY_FAT: {
          const value = numberOrNull(point.qty);
          if (value !== null) {
            acc.bodyFatLast = value;
            acc.bodyFatSeen = true;
          }
          break;
        }
        case METRIC.SLEEP: {
          const asleepHours = numberOrNull(point.asleep);
          if (asleepHours !== null) {
            acc.sleepAsleepHoursSum += asleepHours;
            acc.sleepAsleepSeen = true;
          }
          const deep = numberOrNull(point.deep);
          if (deep !== null) {
            acc.sleepDeepSum += deep;
            acc.sleepDeepSeen = true;
          }
          const rem = numberOrNull(point.rem);
          if (rem !== null) {
            acc.sleepRemSum += rem;
            acc.sleepRemSeen = true;
          }
          const core = numberOrNull(point.core);
          if (core !== null) {
            acc.sleepCoreSum += core;
            acc.sleepCoreSeen = true;
          }
          const awake = numberOrNull(point.awake);
          if (awake !== null) {
            acc.sleepAwakeSum += awake;
            acc.sleepAwakeSeen = true;
          }
          break;
        }
        default:
          break; // unrecognized metric — not tracked in v1
      }
    }
  }

  return Array.from(accumulatorsByDate.values()).map(accumulatorToRow);
}

function accumulatorToRow(acc: Accumulator): DailyMetricsRow {
  const deep = acc.sleepDeepSeen ? Math.round(acc.sleepDeepSum * 60) : null;
  const rem = acc.sleepRemSeen ? Math.round(acc.sleepRemSum * 60) : null;
  const core = acc.sleepCoreSeen ? Math.round(acc.sleepCoreSum * 60) : null;
  const awake = acc.sleepAwakeSeen ? Math.round(acc.sleepAwakeSum * 60) : null;
  const allStagesNull = deep === null && rem === null && core === null && awake === null;

  return {
    date: acc.date,
    steps: acc.stepsSeen ? acc.stepsSum : null,
    active_calories: acc.activeCaloriesSeen ? acc.activeCaloriesSum : null,
    exercise_minutes: acc.exerciseMinutesSeen ? acc.exerciseMinutesSum : null,
    resting_hr: acc.restingHrSeen ? acc.restingHrLast : null,
    avg_hr: acc.hrCount > 0 ? acc.hrSum / acc.hrCount : null,
    sleep_duration_min: acc.sleepAsleepSeen ? Math.round(acc.sleepAsleepHoursSum * 60) : null,
    sleep_stages_json: allStagesNull ? null : JSON.stringify({ deep, rem, core, awake }),
    weight_kg: acc.weightSeen ? acc.weightLast : null,
    body_fat_pct: acc.bodyFatSeen ? acc.bodyFatLast : null,
    updated_at: acc.updatedAt,
  };
}

function extractDate(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10) {
    throw new PayloadError(`Invalid or missing date: ${JSON.stringify(value)}`);
  }
  const date = value.slice(0, 10);
  if (!DATE_RE.test(date)) {
    throw new PayloadError(`Invalid or missing date: ${JSON.stringify(value)}`);
  }
  return date;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
