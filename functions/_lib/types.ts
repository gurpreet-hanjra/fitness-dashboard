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
  AI: Ai;
}

export interface HrZones {
  light_sec: number | null;
  intensive_sec: number | null;
  aerobic_sec: number | null;
  anaerobic_sec: number | null;
  vo2max_sec: number | null;
}

export interface ExtractedWorkout {
  started_at?: string;
  sport?: string;
  duration_sec?: number | null;
  active_kcal?: number | null;
  total_kcal?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  hr_zones?: HrZones | null;
  training_effect_aerobic?: number | null;
  training_effect_anaerobic?: number | null;
  training_load?: number | null;
  training_load_label?: string | null;
  recovery_hours?: number | null;
  vitality_score?: number | null;
  source_device?: string | null;
}

export interface WorkoutRow {
  started_at: string;
  sport: string;
  duration_sec: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zones_json: string | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  training_load: number | null;
  training_load_label: string | null;
  recovery_hours: number | null;
  vitality_score: number | null;
  source_device: string | null;
  created_at: string;
}
