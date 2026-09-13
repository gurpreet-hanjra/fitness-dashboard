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

  it('sums multiple step_count points for the same date', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'step_count',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 3000 },
              { date: '2026-09-01 14:00:00 +0000', qty: 5000 },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].steps).toBe(8000);
  });

  it('sums multiple active_energy and apple_exercise_time points for the same date', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'active_energy',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 200 },
              { date: '2026-09-01 14:00:00 +0000', qty: 250 },
            ],
          },
          {
            name: 'apple_exercise_time',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 10 },
              { date: '2026-09-01 14:00:00 +0000', qty: 25 },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].active_calories).toBe(450);
    expect(rows[0].exercise_minutes).toBe(35);
  });

  it('converts active_energy from kJ to kcal when the metric declares kJ units', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'active_energy',
            units: 'kJ',
            data: [{ date: '2026-09-01 08:00:00 +0000', qty: 418.4 }],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].active_calories).toBeCloseTo(100, 5);
  });

  it('averages multiple heart_rate points for the same date', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'heart_rate',
            data: [
              { date: '2026-09-01 08:00:00 +0000', Avg: 70 },
              { date: '2026-09-01 14:00:00 +0000', Avg: 80 },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].avg_hr).toBe(75);
  });

  it('does not let a heart_rate point missing Avg corrupt the running average', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'heart_rate',
            data: [
              { date: '2026-09-01 08:00:00 +0000', Avg: 70 },
              { date: '2026-09-01 14:00:00 +0000', Min: 60, Max: 90 }, // no Avg field
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].avg_hr).toBe(70);
  });

  it('uses last-non-null semantics for resting_heart_rate, weight_body_mass, and body_fat_percentage', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'resting_heart_rate',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 58 },
              { date: '2026-09-01 14:00:00 +0000', qty: 60 },
            ],
          },
          {
            name: 'weight_body_mass',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 82.3 },
              { date: '2026-09-01 14:00:00 +0000' }, // missing qty — should not erase the earlier value
            ],
          },
          {
            name: 'body_fat_percentage',
            data: [
              { date: '2026-09-01 08:00:00 +0000', qty: 22.1 },
              { date: '2026-09-01 14:00:00 +0000', qty: 21.9 },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].resting_hr).toBe(60);
    expect(rows[0].weight_kg).toBe(82.3);
    expect(rows[0].body_fat_pct).toBe(21.9);
  });

  it('sums sleep_analysis stages and asleep hours across multiple points for the same date', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'sleep_analysis',
            data: [
              { date: '2026-09-01 00:00:00 +0000', asleep: 4, deep: 0.5, rem: 0.5, core: 2.5, awake: 0.2 },
              { date: '2026-09-01 04:00:00 +0000', asleep: 3.5, deep: 0.7, rem: 1.0, core: 1.7, awake: 0.4 },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].sleep_duration_min).toBe(450); // 7.5 hours
    expect(JSON.parse(rows[0].sleep_stages_json as string)).toEqual({ deep: 72, rem: 90, core: 252, awake: 36 });
  });

  it('sets sleep_stages_json to null when all stage values are null', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'sleep_analysis',
            data: [{ date: '2026-09-01 00:00:00 +0000', asleep: 7.5 }],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].sleep_duration_min).toBe(450);
    expect(rows[0].sleep_stages_json).toBeNull();
  });

  it('falls back to inBed when asleep is 0 (observed Mi Fitness behavior: real inBed, zeroed stages)', () => {
    const payload = {
      data: {
        metrics: [
          {
            name: 'sleep_analysis',
            data: [
              {
                date: '2026-09-13 00:00:00 +0200',
                asleep: 0,
                inBed: 3.2,
                core: 0,
                deep: 0,
                rem: 0,
                awake: 0,
              },
            ],
          },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].sleep_duration_min).toBe(192); // 3.2 hours, from inBed
    // Stages were explicitly reported as 0 (not omitted), so they're stored as
    // zero, not null — the inBed fallback only affects sleep_duration_min.
    expect(JSON.parse(rows[0].sleep_stages_json as string)).toEqual({ deep: 0, rem: 0, core: 0, awake: 0 });
  });

  it('keeps sleep_duration_min at 0 when asleep is 0 and inBed is absent', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'sleep_analysis', data: [{ date: '2026-09-01 00:00:00 +0000', asleep: 0 }] },
        ],
      },
    };
    const rows = parsePayload(payload);
    expect(rows[0].sleep_duration_min).toBe(0);
  });

  it('throws PayloadError for a non-date-shaped string', () => {
    const payload = {
      data: { metrics: [{ name: 'step_count', data: [{ date: 'not a date at all', qty: 100 }] }] },
    };
    expect(() => parsePayload(payload)).toThrow(PayloadError);
  });
});
