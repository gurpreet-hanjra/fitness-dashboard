import type { Env } from '../_lib/types';
import { isAuthorized } from '../_lib/auth';
import { parsePayload, PayloadError } from '../_lib/payload';
import { upsertDailyMetrics } from '../_lib/db';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAuthorized(request, env.INGEST_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  try {
    const rows = parsePayload(json);
    await upsertDailyMetrics(env.DB, rows);
    return new Response(JSON.stringify({ ingested: rows.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof PayloadError) {
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }
};
