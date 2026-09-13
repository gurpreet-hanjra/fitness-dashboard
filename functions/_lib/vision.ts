import type { ExtractedWorkout } from './types';

// Mistral (a French/EU company) rather than a Llama vision model, whose
// license requires representing you are not EU-domiciled -- not viable here.
const MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct' as const;

// Duration fields are extracted as literal "HH:MM:SS" strings read straight
// off the card, then converted to seconds deterministically in code below --
// asking the model to do the arithmetic itself proved unreliable in manual
// testing (it correctly read some zones but miscalculated others' seconds).
interface WorkoutJsonResult {
  started_at?: string;
  sport?: string;
  duration_hms?: string;
  active_kcal?: number;
  total_kcal?: number;
  avg_hr?: number;
  max_hr?: number;
  hr_zone_light_hms?: string;
  hr_zone_intensive_hms?: string;
  hr_zone_aerobic_hms?: string;
  hr_zone_anaerobic_hms?: string;
  hr_zone_vo2max_hms?: string;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  training_load?: number;
  training_load_label?: string;
  recovery_hours?: number;
  vitality_score?: number;
  source_device?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const HMS_RE = /^(\d{1,2}):(\d{2}):(\d{2})$/;

function hmsToSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = HMS_RE.exec(value.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function hasAnyHrZoneField(result: WorkoutJsonResult): boolean {
  return (
    result.hr_zone_light_hms !== undefined ||
    result.hr_zone_intensive_hms !== undefined ||
    result.hr_zone_aerobic_hms !== undefined ||
    result.hr_zone_anaerobic_hms !== undefined ||
    result.hr_zone_vo2max_hms !== undefined
  );
}

export type VisionExtractor = (imageBytes: ArrayBuffer, contentType: string, ai: Ai) => Promise<ExtractedWorkout>;

const EXTRACTION_PROMPT = `Extract the workout summary data from this Mi Fitness workout card image into a single flat JSON object with exactly these keys (omit a key entirely if that value is not visible on the card):

started_at (string, ISO 8601, combine the date and start time shown, e.g. "2026-08-17T20:03:14"), sport (string), duration_hms (string, the "Workout time" value copied exactly as printed in HH:MM:SS form), active_kcal (number), total_kcal (number), avg_hr (number), max_hr (number), hr_zone_light_hms (string, HH:MM:SS as printed), hr_zone_intensive_hms (string), hr_zone_aerobic_hms (string), hr_zone_anaerobic_hms (string), hr_zone_vo2max_hms (string), training_effect_aerobic (number), training_effect_anaerobic (number), training_load (number), training_load_label (string), recovery_hours (number), vitality_score (number), source_device (string).

Copy every HH:MM:SS value exactly as printed -- do not do any arithmetic or unit conversion yourself. Respond with ONLY the JSON object and nothing else: no markdown code fences, no explanation, no surrounding text.`;

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const braced = text.match(/\{[\s\S]*\}/);
  if (braced) return braced[0];
  return text;
}

export const callVisionExtraction: VisionExtractor = async (imageBytes, contentType, ai) => {
  const base64Image = arrayBufferToBase64(imageBytes);

  const output = await ai.run(MODEL, {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64Image}` } },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const text = output.response;
  if (!text) {
    throw new Error('Empty response from vision model');
  }

  let result: WorkoutJsonResult;
  try {
    result = JSON.parse(extractJsonObject(text)) as WorkoutJsonResult;
  } catch {
    throw new Error(`Vision model response was not valid JSON. Raw text: ${text}`);
  }

  return {
    started_at: result.started_at,
    sport: result.sport,
    duration_sec: hmsToSeconds(result.duration_hms),
    active_kcal: result.active_kcal ?? null,
    total_kcal: result.total_kcal ?? null,
    avg_hr: result.avg_hr ?? null,
    max_hr: result.max_hr ?? null,
    hr_zones: hasAnyHrZoneField(result)
      ? {
          light_sec: hmsToSeconds(result.hr_zone_light_hms),
          intensive_sec: hmsToSeconds(result.hr_zone_intensive_hms),
          aerobic_sec: hmsToSeconds(result.hr_zone_aerobic_hms),
          anaerobic_sec: hmsToSeconds(result.hr_zone_anaerobic_hms),
          vo2max_sec: hmsToSeconds(result.hr_zone_vo2max_hms),
        }
      : null,
    training_effect_aerobic: result.training_effect_aerobic ?? null,
    training_effect_anaerobic: result.training_effect_anaerobic ?? null,
    training_load: result.training_load ?? null,
    training_load_label: result.training_load_label ?? null,
    recovery_hours: result.recovery_hours ?? null,
    vitality_score: result.vitality_score ?? null,
    source_device: result.source_device ?? null,
  };
};
