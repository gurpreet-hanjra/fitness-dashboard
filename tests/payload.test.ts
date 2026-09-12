import { describe, it, expect } from 'vitest';
import { parsePayload, PayloadError } from '../functions/_lib/payload';

describe('parsePayload', () => {
  it('throws PayloadError when data.metrics is missing', () => {
    expect(() => parsePayload({})).toThrow(PayloadError);
  });

  it('throws PayloadError when a metric is missing name or data', () => {
    expect(() => parsePayload({ data: { metrics: [{ data: [] }] } })).toThrow(PayloadError);
  });

  it('throws PayloadError when a data point has no date', () => {
    const payload = { data: { metrics: [{ name: 'step_count', data: [{ qty: 100 }] }] } };
    expect(() => parsePayload(payload)).toThrow(PayloadError);
  });

  it('maps step_count, active_energy, and apple_exercise_time by date', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'step_count', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 8000 }] },
          { name: 'active_energy', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 450 }] },
          { name: 'apple_exercise_time', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 35 }] },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-09-01',
      steps: 8000,
      active_calories: 450,
      exercise_minutes: 35,
    });
  });

  it('maps heart_rate (Avg) and resting_heart_rate (qty) separately', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'heart_rate', data: [{ date: '2026-09-01 00:00:00 +0000', Min: 55, Max: 140, Avg: 72 }] },
          { name: 'resting_heart_rate', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 58 }] },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].avg_hr).toBe(72);
    expect(rows[0].resting_hr).toBe(58);
  });

  it('maps weight_body_mass and body_fat_percentage', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'weight_body_mass', data: [{ date: '2026-09-01 08:00:00 +0000', qty: 82.3 }] },
          { name: 'body_fat_percentage', data: [{ date: '2026-09-01 08:00:00 +0000', qty: 22.1 }] },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].weight_kg).toBe(82.3);
    expect(rows[0].body_fat_pct).toBe(22.1);
  });

  it('converts sleep_analysis hours into minutes and a stages JSON blob', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'sleep_analysis',
            data: [{ date: '2026-09-01 00:00:00 +0000', asleep: 7.5, deep: 1.2, rem: 1.5, core: 4.2, awake: 0.6 }],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].sleep_duration_min).toBe(450);
    expect(JSON.parse(rows[0].sleep_stages_json as string)).toEqual({ deep: 72, rem: 90, core: 252, awake: 36 });
  });

  it('ignores unrecognized metric names', () => {
    const payload = {
      data: { metrics: [{ name: 'body_mass_index', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 24.1 }] }] },
    };
    const rows = parsePayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBeNull();
  });

  it('merges multiple metrics for the same date into one row', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'step_count', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 8000 }] },
          { name: 'weight_body_mass', data: [{ date: '2026-09-01 08:00:00 +0000', qty: 82.3 }] },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBe(8000);
    expect(rows[0].weight_kg).toBe(82.3);
  });
});
