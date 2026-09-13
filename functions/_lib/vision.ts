import type { ExtractedWorkout } from './types';

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct' as const;

interface WorkoutToolArguments {
  started_at?: string;
  sport?: string;
  duration_sec?: number;
  active_kcal?: number;
  total_kcal?: number;
  avg_hr?: number;
  max_hr?: number;
  hr_zone_light_sec?: number;
  hr_zone_intensive_sec?: number;
  hr_zone_aerobic_sec?: number;
  hr_zone_anaerobic_sec?: number;
  hr_zone_vo2max_sec?: number;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  training_load?: number;
  training_load_label?: string;
  recovery_hours?: number;
  vitality_score?: number;
  source_device?: string;
}

const WORKOUT_TOOL = {
  name: 'record_workout',
  description:
    'Record the structured workout summary data read from the image. Only include a field if it is clearly visible on the card; omit fields you cannot confidently read.',
  parameters: {
    type: 'object',
    required: ['started_at', 'sport'],
    properties: {
      started_at: {
        type: 'string',
        description:
          'ISO 8601 timestamp combining the date and start time shown on the card, e.g. "2026-08-17T20:03:14".',
      },
      sport: { type: 'string', description: 'The workout/sport name shown at the top of the card, e.g. "Hockey".' },
      duration_sec: {
        type: 'number',
        description: 'Workout duration in seconds, converted from the HH:MM:SS "Workout time" value shown.',
      },
      active_kcal: { type: 'number', description: 'The large calorie number shown (active/workout calories).' },
      total_kcal: { type: 'number', description: 'The separate "Total kcal" value, if shown.' },
      avg_hr: { type: 'number', description: 'Average heart rate in BPM.' },
      max_hr: { type: 'number', description: 'Maximum heart rate in BPM.' },
      hr_zone_light_sec: {
        type: 'number',
        description: 'Time spent in the "Light" heart rate zone, in seconds, converted from HH:MM:SS.',
      },
      hr_zone_intensive_sec: {
        type: 'number',
        description: 'Time spent in the "Intensive" heart rate zone, in seconds.',
      },
      hr_zone_aerobic_sec: { type: 'number', description: 'Time spent in the "Aerobic" heart rate zone, in seconds.' },
      hr_zone_anaerobic_sec: {
        type: 'number',
        description: 'Time spent in the "Anaerobic" heart rate zone, in seconds.',
      },
      hr_zone_vo2max_sec: { type: 'number', description: 'Time spent in the "VO2 max" heart rate zone, in seconds.' },
      training_effect_aerobic: { type: 'number', description: 'Aerobic training effect score shown, e.g. 5.0.' },
      training_effect_anaerobic: { type: 'number', description: 'Anaerobic training effect score shown, e.g. 2.2.' },
      training_load: { type: 'number', description: 'Training load number shown, e.g. 286.' },
      training_load_label: {
        type: 'string',
        description: 'The qualitative label shown next to training load, e.g. "Very high".',
      },
      recovery_hours: { type: 'number', description: 'Recovery time in hours shown, e.g. 72.' },
      vitality_score: { type: 'number', description: 'Vitality score shown, e.g. 64.' },
      source_device: { type: 'string', description: 'The source device shown, e.g. "Xiaomi Smart Band 10".' },
    },
  },
};

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

function hasAnyHrZoneField(args: WorkoutToolArguments): boolean {
  return (
    args.hr_zone_light_sec !== undefined ||
    args.hr_zone_intensive_sec !== undefined ||
    args.hr_zone_aerobic_sec !== undefined ||
    args.hr_zone_anaerobic_sec !== undefined ||
    args.hr_zone_vo2max_sec !== undefined
  );
}

export type VisionExtractor = (imageBytes: ArrayBuffer, contentType: string, ai: Ai) => Promise<ExtractedWorkout>;

export const callVisionExtraction: VisionExtractor = async (imageBytes, contentType, ai) => {
  const base64Image = arrayBufferToBase64(imageBytes);

  const output = await ai.run(MODEL, {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the structured workout summary data from this Mi Fitness workout card image using the record_workout tool.',
          },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64Image}` } },
        ],
      },
    ],
    tools: [WORKOUT_TOOL],
  });

  const toolCall = output.tool_calls?.find((call) => call.name === 'record_workout');
  if (!toolCall || !toolCall.arguments) {
    throw new Error('No record_workout tool call in Workers AI response');
  }

  const args = toolCall.arguments as WorkoutToolArguments;

  return {
    started_at: args.started_at,
    sport: args.sport,
    duration_sec: args.duration_sec ?? null,
    active_kcal: args.active_kcal ?? null,
    total_kcal: args.total_kcal ?? null,
    avg_hr: args.avg_hr ?? null,
    max_hr: args.max_hr ?? null,
    hr_zones: hasAnyHrZoneField(args)
      ? {
          light_sec: args.hr_zone_light_sec ?? null,
          intensive_sec: args.hr_zone_intensive_sec ?? null,
          aerobic_sec: args.hr_zone_aerobic_sec ?? null,
          anaerobic_sec: args.hr_zone_anaerobic_sec ?? null,
          vo2max_sec: args.hr_zone_vo2max_sec ?? null,
        }
      : null,
    training_effect_aerobic: args.training_effect_aerobic ?? null,
    training_effect_anaerobic: args.training_effect_anaerobic ?? null,
    training_load: args.training_load ?? null,
    training_load_label: args.training_load_label ?? null,
    recovery_hours: args.recovery_hours ?? null,
    vitality_score: args.vitality_score ?? null,
    source_device: args.source_device ?? null,
  };
};
