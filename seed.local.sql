-- Mock data for local development only. Never run against --remote.
-- Usage: npx wrangler d1 execute fitness-dashboard-db --local --file=seed.local.sql

DELETE FROM daily_metrics;
DELETE FROM goals;
DELETE FROM workouts;

INSERT INTO daily_metrics (date, steps, active_calories, exercise_minutes, resting_hr, avg_hr, sleep_duration_min, weight_kg, body_fat_pct, updated_at) VALUES
  (date('now', '-13 day'), 8123, 412, 38, 58, 71, 445, 84.6, 21.2, datetime('now')),
  (date('now', '-12 day'), 6210, 305, 22, 59, 70, 398, 84.4, NULL,  datetime('now')),
  (date('now', '-11 day'), 11890, 620, 61, 57, 74, 421, 84.3, NULL,  datetime('now')),
  (date('now', '-10 day'), 9432, 455, 40, 58, 72, 460, 84.1, 21.0, datetime('now')),
  (date('now', '-9 day'),  5230, 260, 15, 60, 69, 380, 84.0, NULL,  datetime('now')),
  (date('now', '-8 day'),  14210, 705, 74, 56, 76, 405, 83.9, NULL,  datetime('now')),
  (date('now', '-7 day'),  7654, 380, 30, 59, 71, 432, 83.8, 20.7, datetime('now')),
  (date('now', '-6 day'),  8901, 420, 35, 58, 72, 415, 83.7, NULL,  datetime('now')),
  (date('now', '-5 day'),  10233, 510, 48, 57, 73, 448, 83.6, NULL,  datetime('now')),
  (date('now', '-4 day'),  6870, 340, 25, 59, 70, 390, 83.5, 20.5, datetime('now')),
  (date('now', '-3 day'),  12456, 640, 58, 56, 75, 410, 83.4, NULL,  datetime('now')),
  (date('now', '-2 day'),  9087, 445, 37, 58, 72, 425, 83.3, NULL,  datetime('now')),
  (date('now', '-1 day'),  7345, 365, 28, 59, 71, 470, 83.1, 20.2, datetime('now')),
  (date('now'),            3120, 150, 10, 58, 70, NULL, 82.9, NULL,  datetime('now'));

INSERT INTO goals (metric, target, set_at) VALUES
  ('weight_kg', 80.0, datetime('now'));

INSERT INTO workouts (
  started_at, sport, duration_sec, active_kcal, total_kcal, avg_hr, max_hr,
  training_effect_aerobic, training_effect_anaerobic, training_load, training_load_label,
  recovery_hours, vitality_score, source_device, image_key, advice, created_at
) VALUES
  (
    datetime('now', '-2 day', '20:30'), 'Hockey', 4380, 620, 780, 152, 189,
    4.2, 2.8, 245, 'Very high',
    72, 68, 'Apple Watch', NULL,
    '## Analysis
Today''s session carried a very high training load (245) with strong HR intensity (152/189 bpm). A vitality score of 68 suggests you''re managing the accumulated fatigue reasonably well so far.

## Comparison to Previous Workout
Compared to your last session (load 190, ''High''), this one was noticeably harder. Recovery time increased from 48h to 72h, and your average HR climbed from 145 to 152 -- a sign of increased intensity, not necessarily a bad thing on its own.

## Action Items

### Recovery
- Prioritize 8+ hours of sleep tonight and tomorrow
- Light mobility work or a short walk is fine on day 2 -- nothing high-intensity
- Hold off on another very-high-load session until the 72h window closes

### Nutrition This Week
- Rehydrate aggressively today: aim for 3-4L water plus electrolytes
- Get protein in within 2 hours post-session to support muscle repair
- On lighter training days this week, scale back carb intake slightly versus today',
    datetime('now', '-2 day')
  ),
  (
    datetime('now', '-6 day', '18:15'), 'Hockey', 3900, 540, 690, 145, 181,
    3.6, 2.1, 190, 'High',
    48, 74, 'Apple Watch', NULL,
    NULL,
    datetime('now', '-6 day')
  );
