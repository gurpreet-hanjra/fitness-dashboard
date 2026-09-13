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

CREATE TABLE IF NOT EXISTS workouts (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at                 TEXT NOT NULL UNIQUE,
  sport                      TEXT NOT NULL,
  duration_sec               INTEGER,
  active_kcal                INTEGER,
  total_kcal                 INTEGER,
  avg_hr                     INTEGER,
  max_hr                     INTEGER,
  hr_zones_json              TEXT,
  training_effect_aerobic    REAL,
  training_effect_anaerobic  REAL,
  training_load               INTEGER,
  training_load_label         TEXT,
  recovery_hours               INTEGER,
  vitality_score                INTEGER,
  source_device                 TEXT,
  image_key                     TEXT,
  created_at                    TEXT NOT NULL
);
