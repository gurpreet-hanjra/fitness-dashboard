import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestPost } from '../functions/api/ingest';
import { createTestDb, makeEnv, makeRequest } from './helpers';
import type { D1Like } from '../functions/_lib/types';

describe('POST /api/ingest', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('rejects requests without the secret header', async () => {
    const request = makeRequest('https://x/api/ingest', { method: 'POST', body: '{}' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await onRequestPost({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects requests with the wrong secret', async () => {
    const request = makeRequest('https://x/api/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'wrong' },
      body: '{}',
    });
    const response = await onRequestPost({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(401);
  });

  it('rejects malformed payloads', async () => {
    const request = makeRequest('https://x/api/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: JSON.stringify({ not: 'valid' }),
    });
    const response = await onRequestPost({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('rejects bodies that are not valid JSON', async () => {
    const request = makeRequest('https://x/api/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: 'not json',
    });
    const response = await onRequestPost({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(400);
  });

  it('ingests a valid payload and stores it', async () => {
    const payload = {
      data: {
        metrics: [
          { name: 'step_count', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 8000 }] },
          { name: 'weight_body_mass', data: [{ date: '2026-09-01 08:00:00 +0000', qty: 82.3 }] },
        ],
      },
    };
    const request = makeRequest('https://x/api/ingest', {
      method: 'POST',
      headers: { 'X-Ingest-Secret': 'test-secret' },
      body: JSON.stringify(payload),
    });
    const response = await onRequestPost({ request, env: makeEnv(db) } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ingested: number };
    expect(body.ingested).toBe(1);

    const row = await db
      .prepare('SELECT * FROM daily_metrics WHERE date = ?')
      .bind('2026-09-01')
      .first<{ steps: number; weight_kg: number }>();
    expect(row?.steps).toBe(8000);
    expect(row?.weight_kg).toBe(82.3);
  });

  it('a second payload for the same date merges rather than overwrites unrelated fields', async () => {
    const first = { data: { metrics: [{ name: 'step_count', data: [{ date: '2026-09-01 00:00:00 +0000', qty: 8000 }] }] } };
    const second = { data: { metrics: [{ name: 'weight_body_mass', data: [{ date: '2026-09-01 08:00:00 +0000', qty: 82.3 }] }] } };

    await onRequestPost({
      request: makeRequest('https://x/api/ingest', {
        method: 'POST',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: JSON.stringify(first),
      }),
      env: makeEnv(db),
    } as any);
    await onRequestPost({
      request: makeRequest('https://x/api/ingest', {
        method: 'POST',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: JSON.stringify(second),
      }),
      env: makeEnv(db),
    } as any);

    const row = await db
      .prepare('SELECT * FROM daily_metrics WHERE date = ?')
      .bind('2026-09-01')
      .first<{ steps: number; weight_kg: number }>();
    expect(row?.steps).toBe(8000);
    expect(row?.weight_kg).toBe(82.3);
  });
});
