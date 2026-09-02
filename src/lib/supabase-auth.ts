/**
 * Server-side session helpers.
 *
 * Server only — this imports `next/headers`. The browser half lives in `supabase-browser.ts`;
 * keeping them apart is what stops the login page pulling server code into the client bundle.
 *
 * Distinct from `supabase.ts`, which holds the service-role client used for data queries. Two
 * clients with sharply different powers, deliberately kept separate:
 *
 *   supabase.ts       service role, bypasses RLS, reads and writes everything
 *   supabase-auth.ts  publishable key, knows who is signed in, can read nothing
 */

import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Read-only cookies in a Server Component. The proxy refreshes the session, so this
          // is safe to ignore rather than a silent failure.
        }
      },
    },
  });
}

/** The signed-in user, or null. */
export async function getUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
