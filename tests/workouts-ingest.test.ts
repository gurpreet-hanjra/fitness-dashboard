import { describe, it, expect, beforeEach } from 'vitest';
import { createIngestHandler } from '../functions/api/workouts/ingest';
import { createTestDb, makeEnv, makeRequest, createTestR2 } from './helpers';
import type { D1Like, ExtractedWorkout, Env, R2Like } from '../functions/_lib/types';
import type { VisionExtractor } from '../functions/_lib/vision';
import type { AdviceGenerator } from '../functions/_lib/advice';

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

function fakeAdvisor(text: string): AdviceGenerator {
  return async () => text;
}

function throwingAdvisor(): AdviceGenerator {
  return async () => {
    throw new Error('advice boom');
  };
}

const DEFAULT_ADVICE = 'Great session -- prioritize hydration and protein tonight, and rest tomorrow.';

describe('POST /api/workouts/ingest', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('rejects requests without the secret header', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects requests with the wrong secret', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'wrong' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects an empty body', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('returns 422 and writes nothing when extraction throws', async () => {
    const handler = createIngestHandler(throwingExtractor(), fakeAdvisor(DEFAULT_ADVICE));
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
    const handler = createIngestHandler(fakeExtractor({ sport: 'Hockey' }), fakeAdvisor(DEFAULT_ADVICE)); // no started_at
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

  it('ingests a valid extraction and stores it, including advice', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sport: string; training_load: number; advice: string };
    expect(body.sport).toBe('Hockey');
    expect(body.training_load).toBe(286);
    expect(body.advice).toBe(DEFAULT_ADVICE);

    const row = await db
      .prepare('SELECT * FROM workouts WHERE started_at = ?')
      .bind('2026-08-17T20:03:14')
      .first<{ training_load: number; advice: string }>();
    expect(row?.training_load).toBe(286);
    expect(row?.advice).toBe(DEFAULT_ADVICE);
  });

  it('re-ingesting the same started_at upserts rather than duplicating', async () => {
    const handler1 = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
    const request1 = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    await handler1({ request: request1, env: makeEnv(db) } as any);

    const handler2 = createIngestHandler(
      fakeExtractor({ ...FULL_EXTRACTION, training_load: 300 }),
      fakeAdvisor(DEFAULT_ADVICE)
    );
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
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
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
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), fakeAdvisor(DEFAULT_ADVICE));
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

  it('still ingests successfully with advice null when advice generation fails', async () => {
    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), throwingAdvisor());
    const request = makeRequest('https://x/api/workouts/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: new Uint8Array([1, 2, 3]),
    });
    const response = await handler({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { advice: string | null; training_load: number };
    expect(body.advice).toBeNull();
    expect(body.training_load).toBe(286);

    const row = await db
      .prepare('SELECT * FROM workouts WHERE started_at = ?')
      .bind('2026-08-17T20:03:14')
      .first<{ advice: string | null }>();
    expect(row?.advice).toBeNull();
  });

  it('gives the advisor context built from prior history (integration of Task 2 + Task 4)', async () => {
    // Seed a prior workout so the advisor call receives non-empty recentWorkouts.
    const seedHandler = createIngestHandler(
      fakeExtractor({ ...FULL_EXTRACTION, started_at: '2026-08-10T18:00:00', training_load: 150 }),
      fakeAdvisor(DEFAULT_ADVICE)
    );
    await seedHandler({
      request: makeRequest('https://x/api/workouts/ingest', {
        method: 'POST',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: new Uint8Array([1, 2, 3]),
      }),
      env: makeEnv(db),
    } as any);

    let receivedRecentWorkoutsCount = -1;
    const capturingAdvisor: AdviceGenerator = async (context) => {
      receivedRecentWorkoutsCount = context.recentWorkouts.length;
      return DEFAULT_ADVICE;
    };

    const handler = createIngestHandler(fakeExtractor(FULL_EXTRACTION), capturingAdvisor);
    await handler({
      request: makeRequest('https://x/api/workouts/ingest', {
        method: 'POST',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: new Uint8Array([1, 2, 3]),
      }),
      env: makeEnv(db),
    } as any);

    expect(receivedRecentWorkoutsCount).toBe(1);
  });
});
