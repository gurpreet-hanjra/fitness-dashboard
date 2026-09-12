import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet, onRequestPut } from '../functions/api/goals';
import { createTestDb, makeEnv, makeRequest } from './helpers';
import type { D1Like, Goal } from '../functions/_lib/types';

describe('/api/goals', () => {
  let db: D1Like;

  beforeEach(() => {
    db = createTestDb();
  });

  it('GET returns null when no goal is set', async () => {
    const response = await onRequestGet({
      request: makeRequest('https://x/api/goals?metric=weight_kg'),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('PUT rejects requests without the secret', async () => {
    const response = await onRequestPut({
      request: makeRequest('https://x/api/goals', {
        method: 'PUT',
        body: JSON.stringify({ metric: 'weight_kg', target: 75 }),
      }),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(401);
  });

  it('PUT rejects a missing metric or non-numeric target', async () => {
    const response = await onRequestPut({
      request: makeRequest('https://x/api/goals', {
        method: 'PUT',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: JSON.stringify({ metric: 'weight_kg', target: 'not-a-number' }),
      }),
      env: makeEnv(db),
    } as any);
    expect(response.status).toBe(400);
  });

  it('PUT sets the goal, then GET returns it', async () => {
    const putResponse = await onRequestPut({
      request: makeRequest('https://x/api/goals', {
        method: 'PUT',
        headers: { 'X-Ingest-Secret': 'test-secret' },
        body: JSON.stringify({ metric: 'weight_kg', target: 75 }),
      }),
      env: makeEnv(db),
    } as any);
    expect(putResponse.status).toBe(200);

    const getResponse = await onRequestGet({
      request: makeRequest('https://x/api/goals?metric=weight_kg'),
      env: makeEnv(db),
    } as any);
    const goal = (await getResponse.json()) as Goal;
    expect(goal.target).toBe(75);
  });
});
