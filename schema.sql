CREATE TABLE IF NOT EXISTS daily_metrics (
  date               TEXT PRIMARY KEY,
  steps              INTEGER,
  active_calories    REAL,
  exercise_minutes   INTEGER,
  resting_hr         REAL,
  avg_hr             REAL,
  sleep_duration_min INTEGER,
  sleep_stages_json  TEXT,
  weight_kg          REAL,
  body_fat_pct       REAL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  metric TEXT PRIMARY KEY,
  target REAL NOT NULL,
  set_at TEXT NOT NULL
);
