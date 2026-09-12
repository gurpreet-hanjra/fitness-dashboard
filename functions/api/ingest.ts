import type { Env } from '../_lib/types';
import { isAuthorized } from '../_lib/auth';
import { parsePayload, PayloadError } from '../_lib/payload';
import { upsertDailyMetrics } from '../_lib/db';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAuthorized(request, env.INGEST_SECRET)) {
    console.warn('ingest rejected: unauthorized');
    return new Response('Unauthorized', { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    console.warn('ingest rejected: invalid JSON body');
    return new Response('Invalid JSON body', { status: 400 });
  }

  try {
    const rows = parsePayload(json);
    await upsertDailyMetrics(env.DB, rows);
    console.log(`ingest ok: ${rows.length} row(s)`);
    return new Response(JSON.stringify({ ingested: rows.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof PayloadError) {
      console.warn(`ingest rejected: ${err.message}`);
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }
};
