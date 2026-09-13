import { describe, it, expect, beforeEach } from 'vitest';
import { createIngestHandler } from '../functions/api/workouts/ingest';
import { createTestDb, makeEnv, makeRequest, createTestR2 } from './helpers';
import type { D1Like, ExtractedWorkout, Env, R2Like } from '../functions/_lib/types';
import type { VisionExtractor } from '../functions/_lib/vision';

const FULL_EXTRACTION: ExtractedWorkout = {
  started_at: '2026-08-17T20:03:14',
  sport: 'Hockey',
  duration_sec: 8333,
  active_kcal: 697,
  total_kcal: 935,
  avg_hr: 133,
  max_hr: 185,
  hr_zones: {
    light_sec: 1132,
    intensive_sec: 2060,
    aerobic_sec: 890,
    anaerobic_sec: 2413,
    vo2max_sec: 1209,
  },
  training_effect_aerobic: 5.0,
  training_effect_anaerobic: 2.2,
  training_load: 286,
  training_load_label: 'Very high',
  recovery_hours: 72,
  vitality_score: 64,
  source_device: 'Xiaomi Smart Band 10',
};

function fakeExtractor(result: ExtractedWorkout): VisionExtractor {
  return async () => result;
}

function throwingExtractor(): VisionExtractor {
  return async () => {
    throw new Error('boom');
  };
}

describe('POST /api/workouts/ingest', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('rejects requests without the secret header', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects requests with the wrong secret', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'wrong' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects an empty body', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('returns 422 and writes nothing when extraction throws', async () => {
    const handler = createIngestHandler(throwingExtractor());
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(422);

    const { results } = await db.prepare('SELECT * FROM workouts').bind().all();
    expect(results).toEqual([]);
  });

  it('returns 422 and writes nothing when extraction is missing required fields', async () => {
    const handler = createIngestHandler(fakeExtractor({ sport: 'Hockey' })); // no started_at
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(422);

    const { results } = await db.prepare('SELECT * FROM workouts').bind().all();
    expect(results).toEqual([]);
  });

  it('ingests a valid extraction and stores it', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sport: string; training_load: number };
    expect(body.sport).toBe('Hockey');
    expect(body.training_load).toBe(286);

    const row = await db
      .prepare('SELECT * FROM workouts WHERE started_at = ?')
      .bind('2026-08-17T20:03:14')
      .first<{ training_load: number }>();
    expect(row?.training_load).toBe(286);
  });

  it('re-ingesting the same started_at upserts rather than duplicating', async () => {
    const handler1 = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request1 = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    await handler1({ request: request1, env: makeEnv(db) } as any);

    const handler2 = createIngestHandler(fakeExtractor({ ...FULL_EXTRACTION, training_load: 300 }));
    const request2 = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    await handler2({ request: request2, env: makeEnv(db) } as any);

    const { results } = await db.prepare('SELECT * FROM workouts').bind().all<{ training_load: number }>();
    expect(results).toHaveLength(1);
    expect(results[0].training_load).toBe(300);
  });

  it('uploads the source image to R2 and stores the image_key', async () => {
    const r2 = createTestR2();
    const env: Env = { ...makeEnv(db), WORKOUT_IMAGES: r2 };
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env } as any);
    const body = (await response.json()) as { image_key: string | null };
    expect(body.image_key).toBe('2026-08-17T20-03-14.jpg');

    const stored = await r2.get('2026-08-17T20-03-14.jpg');
    expect(stored).not.toBeNull();
    const storedBytes = new Uint8Array(await stored!.arrayBuffer());
    expect(Array.from(storedBytes)).toEqual([1, 2, 3]);

    const row = await db
      .prepare('SELECT * FROM workouts WHERE started_at = ?')
      .bind('2026-08-17T20:03:14')
      .first<{ image_key: string }>();
    expect(row?.image_key).toBe('2026-08-17T20-03-14.jpg');
  });

  it('still ingests successfully with image_key null when the R2 upload fails', async () => {
    const throwingR2: R2Like = {
      async put() {
        throw new Error('R2 boom');
      },
      async get() {
        return null;
      },
    };
    const env: Env = { ...makeEnv(db), WORKOUT_IMAGES: throwingR2 };
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { image_key: string | null; training_load: number };
    expect(body.image_key).toBeNull();
    expect(body.training_load).toBe(286);
  });
});
