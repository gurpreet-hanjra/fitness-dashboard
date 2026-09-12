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
        // Retained so batch() can re-run this exact bound statement inside a transaction.
        _sql: sql,
        _boundArgs: () => boundArgs,
      } as D1PreparedLike & { _sql: string; _boundArgs: () => unknown[] };
      return prepared;
    },
    async batch(statements: D1PreparedLike[]): Promise<unknown[]> {
      const runAll = sqlite.transaction((stmts: D1PreparedLike[]) => {
        const results: unknown[] = [];
        for (const stmt of stmts) {
          const { _sql, _boundArgs } = stmt as D1PreparedLike & { _sql: string; _boundArgs: () => unknown[] };
          results.push(sqlite.prepare(_sql).run(..._boundArgs()));
        }
        return results;
      });
      return runAll(statements);
    },
  };
}

export function makeEnv(db: D1Like, secret = 'test-secret'): Env {
  return { DB: db, INGEST_SECRET: secret };
}

export function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}
