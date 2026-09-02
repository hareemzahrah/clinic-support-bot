import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase session fresh and turns unauthenticated dashboard requests away.
 *
 * Named `proxy` because Next.js 16 renamed the `middleware` file convention — same behaviour,
 * different filename. The deprecation warning only appears in the dev server log, and the old
 * file silently does nothing, so this looked like broken auth rather than a rename.
 *
 * This is the fast check, not the only one. Next's own guidance is that proxy suits optimistic
 * redirects but should not be the sole authorisation gate, so the admin layout verifies the
 * session again server-side before any query runs.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser revalidates against Supabase rather than trusting the cookie's contents.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/login';
    signIn.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  if (user && request.nextUrl.pathname === '/login') {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = '/admin/gaps';
    dashboard.search = '';
    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
