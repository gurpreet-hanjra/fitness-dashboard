export interface DailyMetricsRow {
  date: string;
  steps: number | null;
  active_calories: number | null;
  exercise_minutes: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_duration_min: number | null;
  sleep_stages_json: string | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  updated_at: string;
}

export interface Goal {
  metric: string;
  target: number;
  set_at: string;
}

export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Like {
  prepare(sql: string): D1PreparedLike;
  batch?(statements: D1PreparedLike[]): Promise<unknown[]>;
}

export interface Env {
  DB: D1Like;
  INGEST_SECRET: string;
}
