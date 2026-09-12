import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers';

describe('test D1 harness', () => {
  it('applies schema.sql and can insert/select a row', async () => {
    const db = createTestDb();
    await db
      .prepare('INSERT INTO goals (metric, target, set_at) VALUES (?, ?, ?)')
      .bind('weight_kg', 75, '2026-09-01T00:00:00.000Z')
      .run();

    const row = await db
      .prepare('SELECT * FROM goals WHERE metric = ?')
      .bind('weight_kg')
      .first<{ metric: string; target: number }>();

    expect(row?.target).toBe(75);
  });
});
