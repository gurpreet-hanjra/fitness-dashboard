import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Like, D1PreparedLike, Env } from '../functions/_lib/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export function createTestDb(): D1Like {
  const sqlite = new Database(':memory:');
  const schema = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf-8');
  sqlite.exec(schema);

  return {
    prepare(sql: string): D1PreparedLike {
      const stmt = sqlite.prepare(sql);
      let boundArgs: unknown[] = [];
      const prepared: D1PreparedLike = {
        bind(...values: unknown[]) {
          boundArgs = values;
          return prepared;
        },
        async run() {
          return stmt.run(...boundArgs);
        },
        async first<T>() {
          return (stmt.get(...boundArgs) as T) ?? null;
        },
        async all<T>() {
          return { results: stmt.all(...boundArgs) as T[] };
        },
      };
      return prepared;
    },
  };
}

export function makeEnv(db: D1Like, secret = 'test-secret'): Env {
  return { DB: db, INGEST_SECRET: secret };
}

export function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}
