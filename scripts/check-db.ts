/**
 * Verify Supabase is reachable and the schema is installed.
 *
 *   npm run check:db
 *
 * Run this before seeding. A misconfigured key or a half-run migration otherwise surfaces as
 * a confusing failure partway through ingestion.
 */

import './load-env';

const TABLES = [
  'documents',
  'chunks',
  'conversations',
  'messages',
  'leads',
  'rate_limits',
] as const;

const ok = (msg: string) => console.log(`  ok    ${msg}`);
const bad = (msg: string) => console.error(`  FAIL  ${msg}`);

async function main() {
  const problems: string[] = [];

  console.log('Environment\n');

  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VOYAGE_API_KEY'] as const) {
    const value = process.env[name];
    if (!value) {
      bad(`${name} is not set`);
      problems.push(`${name} is missing from .env.local`);
    } else {
      ok(`${name} is set (${value.length} chars)`);
    }
  }

  // A very common mistake: pasting the anon key into the service role slot. The anon key is
  // a JWT whose payload contains "anon", and it would fail later with confusing empty results
  // rather than an error, because RLS silently returns zero rows.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // New-style keys are opaque and prefixed. A publishable key here is the same mistake as
  // the old anon key: RLS would return zero rows with no error at all.
  if (key?.startsWith('sb_publishable_')) {
    bad('SUPABASE_SERVICE_ROLE_KEY holds a PUBLISHABLE key, not a secret key');
    problems.push(
      'Project Settings -> API Keys -> Secret keys -> copy or create the sb_secret_... key.',
    );
  }
  if (key?.includes('.')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
      if (payload.role && payload.role !== 'service_role') {
        bad(`SUPABASE_SERVICE_ROLE_KEY looks like the "${payload.role}" key, not service_role`);
        problems.push(
          'You pasted the anon key. Project Settings -> API -> service_role (click to reveal).',
        );
      }
    } catch {
      // Not a decodable JWT — newer Supabase key formats are opaque. Skip the check.
    }
  }

  if (problems.length) return report(problems);

  console.log('\nDatabase\n');

  const { getSupabase } = await import('../src/lib/supabase');
  const supabase = getSupabase();

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      bad(`table "${table}" — ${error.message}`);
      problems.push(`Table "${table}" is missing. Re-run the migration in the SQL editor.`);
    } else {
      ok(`table "${table}"`);
    }
  }

  // Exercise the vector search function with a zero vector. We do not care about results,
  // only that the function exists with the expected signature and that pgvector is enabled.
  const { error: rpcError } = await supabase.rpc('match_chunks', {
    query_embedding: new Array(1024).fill(0),
    match_threshold: 0.99,
    match_count: 1,
  });

  if (rpcError) {
    bad(`match_chunks() — ${rpcError.message}`);
    problems.push(
      'The match_chunks function is missing or has the wrong signature. Re-run the migration.',
    );
  } else {
    ok('match_chunks() with a 1024-dim vector');
  }

  report(problems);
}

function report(problems: string[]) {
  console.log('');
  if (problems.length === 0) {
    console.log('Everything checks out. Run `npm run seed` to index the corpus.');
    return;
  }
  console.error(`${problems.length} problem(s) to fix:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

main().catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
