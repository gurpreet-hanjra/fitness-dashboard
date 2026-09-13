import type { Env } from '../../_lib/types';
import { imageKeyForStartedAt } from '../../_lib/image-store';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const startedAt = url.searchParams.get('started_at');
  if (!startedAt) {
    return new Response('started_at query param is required', { status: 400 });
  }

  const key = imageKeyForStartedAt(startedAt);
  const object = await context.env.WORKOUT_IMAGES.get(key);
  if (!object) {
    return new Response('Image not found', { status: 404 });
  }

  const bytes = await object.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/jpeg' },
  });
};
