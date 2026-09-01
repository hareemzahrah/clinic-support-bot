import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service role key.
 *
 * Every table has RLS enabled with no policies granted, so the anon key can read nothing.
 * The service role key bypasses RLS entirely — which is why this module must never be
 * imported into client code. The widget is embedded on public websites; a browser that
 * holds this key can read the leads table.
 */

let cached: SupabaseClient | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill in your Supabase ` +
        'credentials (Project Settings → API).',
    );
  }
  return value;
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return cached;
}
