import { describe, it, expect } from 'vitest';
import { isAuthorized } from '../functions/_lib/auth';

describe('isAuthorized', () => {
  it('rejects when no header is present', () => {
    const request = new Request('https://x/', {});
    expect(isAuthorized(request, 'secret')).toBe(false);
  });

  it('rejects when the header does not match', () => {
    const request = new Request('https://x/', { headers: { 'X-Ingest-Secret': 'wrong' } });
    expect(isAuthorized(request, 'secret')).toBe(false);
  });

  it('rejects when there is no configured secret', () => {
    const request = new Request('https://x/', { headers: { 'X-Ingest-Secret': 'secret' } });
    expect(isAuthorized(request, undefined)).toBe(false);
  });

  it('accepts when the header matches', () => {
    const request = new Request('https://x/', { headers: { 'X-Ingest-Secret': 'secret' } });
    expect(isAuthorized(request, 'secret')).toBe(true);
  });
});
