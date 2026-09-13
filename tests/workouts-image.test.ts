import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet } from '../functions/api/workouts/image';
import { createTestR2, makeRequest } from './helpers';
import type { R2Like, Env } from '../functions/_lib/types';

function envWithR2(r2: R2Like): Env {
  return {
    DB: {} as unknown as Env['DB'],
    INGEST_SECRET: 'test-secret',
    AI: {} as unknown as Env['AI'],
    WORKOUT_IMAGES: r2,
  };
}

describe('GET /api/workouts/image', () => {
  let r2: R2Like;

  beforeEach(() => {
    r2 = createTestR2();
  });

  it('requires a started_at query param', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts/image'),
      env: envWithR2(r2),
    } as any);
    expect(response.status).toBe(400);
  });

  it('returns 404 when no image exists for that started_at', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts/image?started_at=2026-08-17T20:03:14'),
      env: envWithR2(r2),
    } as any);
    expect(response.status).toBe(404);
  });

  it('returns the stored image bytes and content type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    await r2.put('2026-08-17T20-03-14.jpg', bytes, { httpMetadata: { contentType: 'image/jpeg' } });

    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts/image?started_at=2026-08-17T20:03:14'),
      env: envWithR2(r2),
    } as any);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    const responseBytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(responseBytes)).toEqual([1, 2, 3, 4]);
  });

  it('defaults to image/jpeg when no content type was stored', async () => {
    const bytes = new Uint8Array([9]).buffer;
    await r2.put('2026-08-17T20-03-14.jpg', bytes);

    const response = await onRequestGet({
      request: makeRequest('https://x/api/workouts/image?started_at=2026-08-17T20:03:14'),
      env: envWithR2(r2),
    } as any);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
  });
});
