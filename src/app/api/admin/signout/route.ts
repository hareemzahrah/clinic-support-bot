import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

/** Ends the session and returns to the sign-in page. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
