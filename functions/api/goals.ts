import type { Env } from '../_lib/types';
import { isAuthorized } from '../_lib/auth';
import { getGoal, setGoal } from '../_lib/db';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const metric = url.searchParams.get('metric') ?? 'weight_kg';
  const goal = await getGoal(context.env.DB, metric);
  return new Response(JSON.stringify(goal), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAuthorized(request, env.INGEST_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { metric?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (typeof body.metric !== 'string' || typeof body.target !== 'number') {
    return new Response('metric (string) and target (number) are required', { status: 400 });
  }

  await setGoal(env.DB, body.metric, body.target, new Date().toISOString());
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
