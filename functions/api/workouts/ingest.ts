import type { Env } from '../../_lib/types';
import { isAuthorized } from '../../_lib/auth';
import { callVisionExtraction, type VisionExtractor } from '../../_lib/vision';
import { normalizeExtractedWorkout } from '../../_lib/workout-parse';
import { upsertWorkout } from '../../_lib/workouts-db';
import { imageKeyForStartedAt } from '../../_lib/image-store';
import { buildAdviceContext } from '../../_lib/advice-context';
import { generateAdvice, type AdviceGenerator } from '../../_lib/advice';

export function createIngestHandler(extract: VisionExtractor, advise: AdviceGenerator): PagesFunction<Env> {
  return async (context) => {
    const { request, env } = context;

    if (!isAuthorized(request, env.INGEST_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const imageBytes = await request.arrayBuffer();
    if (imageBytes.byteLength === 0) {
      return new Response('Empty image body', { status: 400 });
    }

    const contentType = request.headers.get('Content-Type') || 'image/jpeg';

    let extracted;
    try {
      extracted = await extract(imageBytes, contentType, env.AI);
    } catch {
      return new Response('Vision extraction failed', { status: 422 });
    }

    const row = normalizeExtractedWorkout(extracted, new Date().toISOString());
    if (!row) {
      return new Response('Could not extract required fields (started_at, sport) from image', { status: 422 });
    }

    // Saving the source image is best-effort: a failed upload should not
    // fail the whole ingest, since the extracted data is still valid and
    // useful without it.
    try {
      const key = imageKeyForStartedAt(row.started_at);
      await env.WORKOUT_IMAGES.put(key, imageBytes, { httpMetadata: { contentType } });
      row.image_key = key;
    } catch {
      row.image_key = null;
    }

    // Advice generation is also best-effort: a failure (context build or
    // the AI call itself) should not fail the whole ingest.
    try {
      const adviceContext = await buildAdviceContext(env.DB, row);
      row.advice = await advise(adviceContext, env);
    } catch {
      row.advice = null;
    }

    await upsertWorkout(env.DB, row);
    return new Response(JSON.stringify(row), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

export const onRequestPost: PagesFunction<Env> = createIngestHandler(callVisionExtraction, generateAdvice);
