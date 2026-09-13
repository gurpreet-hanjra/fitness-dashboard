import type { ExtractedWorkout } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

const WORKOUT_TOOL_SCHEMA = {
  name: 'record_workout',
  description: 'Record the structured workout summary data read from the image.',
  input_schema: {
    type: 'object',
    properties: {
      started_at: {
        type: 'string',
        description:
          'ISO 8601 timestamp combining the date and start time shown on the card, e.g. "2026-08-17T20:03:14".',
      },
      sport: { type: 'string', description: 'The workout/sport name shown at the top of the card, e.g. "Hockey".' },
      duration_sec: {
        type: ['integer', 'null'],
        description: 'Workout duration in seconds, converted from the HH:MM:SS "Workout time" value shown.',
      },
      active_kcal: { type: ['integer', 'null'], description: 'The large calorie number shown (active/workout calories).' },
      total_kcal: { type: ['integer', 'null'], description: 'The separate "Total kcal" value, if shown.' },
      avg_hr: { type: ['integer', 'null'] },
      max_hr: { type: ['integer', 'null'] },
      hr_zones: {
        type: ['object', 'null'],
        description: 'Heart rate zone durations in seconds, converted from the HH:MM:SS values shown per zone.',
        properties: {
          light_sec: { type: ['integer', 'null'] },
          intensive_sec: { type: ['integer', 'null'] },
          aerobic_sec: { type: ['integer', 'null'] },
          anaerobic_sec: { type: ['integer', 'null'] },
          vo2max_sec: { type: ['integer', 'null'] },
        },
      },
      training_effect_aerobic: { type: ['number', 'null'] },
      training_effect_anaerobic: { type: ['number', 'null'] },
      training_load: { type: ['integer', 'null'] },
      training_load_label: {
        type: ['string', 'null'],
        description: 'The qualitative label shown next to training load, e.g. "Very high".',
      },
      recovery_hours: { type: ['integer', 'null'] },
      vitality_score: { type: ['integer', 'null'] },
      source_device: { type: ['string', 'null'] },
    },
    required: ['started_at', 'sport'],
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

export type VisionExtractor = (imageBytes: ArrayBuffer, contentType: string, apiKey: string) => Promise<ExtractedWorkout>;

export const callVisionExtraction: VisionExtractor = async (imageBytes, contentType, apiKey) => {
  const base64Image = arrayBufferToBase64(imageBytes);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: contentType, data: base64Image } },
            {
              type: 'text',
              text: 'Extract the structured workout summary data from this Mi Fitness workout card image using the record_workout tool.',
            },
          ],
        },
      ],
      tools: [WORKOUT_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'record_workout' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API request failed: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; input?: unknown }> };
  const toolUse = data.content.find((block) => block.type === 'tool_use');
  if (!toolUse || !toolUse.input) {
    throw new Error('No tool_use block in Anthropic response');
  }

  return toolUse.input as ExtractedWorkout;
};
