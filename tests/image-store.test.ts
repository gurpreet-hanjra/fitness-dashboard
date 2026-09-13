import { describe, it, expect } from 'vitest';
import { imageKeyForStartedAt } from '../functions/_lib/image-store';

describe('imageKeyForStartedAt', () => {
  it('replaces colons with dashes and adds a .jpg extension', () => {
    expect(imageKeyForStartedAt('2026-08-17T20:03:14')).toBe('2026-08-17T20-03-14.jpg');
  });

  it('produces the same key for the same started_at (deterministic)', () => {
    const a = imageKeyForStartedAt('2026-08-17T20:03:14');
    const b = imageKeyForStartedAt('2026-08-17T20:03:14');
    expect(a).toBe(b);
  });

  it('produces different keys for different started_at values', () => {
    const a = imageKeyForStartedAt('2026-08-17T20:03:14');
    const b = imageKeyForStartedAt('2026-08-18T09:00:00');
    expect(a).not.toBe(b);
  });
});
