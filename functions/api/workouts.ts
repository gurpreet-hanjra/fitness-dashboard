import type { Env } from '../_lib/types';
import { queryWorkoutsRange } from '../_lib/workouts-db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return new Response('from and to query params are required as YYYY-MM-DD', { status: 400 });
  }

  const rows = await queryWorkoutsRange(context.env.DB, from, to);
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
