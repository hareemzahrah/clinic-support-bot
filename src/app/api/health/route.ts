/**
 * GET /api/health — liveness check, and the thing that keeps the demo alive.
 *
 * Supabase pauses free-tier projects after seven consecutive days without database activity. A
 * paused project accepts no connections, so a portfolio link sent in a proposal would be dead by
 * the time a client clicked it a week later — the worst possible failure, because it reads as
 * "this person does not maintain their work" rather than "the free tier expired".
 *
 * A cron hits this daily. The query has to actually touch the database: an HTTP 200 from a static
 * route would keep Vercel warm and let Postgres go to sleep anyway.
 *
 * Deliberately cheap and deliberately free — a count with a head request transfers no rows, and
 * nothing here calls a paid model.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    const { count, error } = await getSupabase()
      .from('chunks')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      chunksIndexed: count ?? 0,
      databaseMs: Date.now() - startedAt,
    });
  } catch (cause) {
    console.error('[health] database unreachable', cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : 'Database unreachable' },
      { status: 503 },
    );
  }
}
