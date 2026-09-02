/**
 * Browser-side Supabase client, for signing in only.
 *
 * Kept in its own module because the server-side counterpart imports `next/headers`, and a
 * single shared file dragged that into the client bundle — which fails the build with a
 * confusing "you are using it in the Pages Router" error on an App Router project.
 *
 * The publishable key is safe here: RLS is enabled on every table with no policies granted, so
 * this client cannot read a row. Its only job is proving who is signed in.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.',
    );
  }

  return createBrowserClient(url, key);
}
