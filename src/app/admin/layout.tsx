import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-auth';

/**
 * Practice dashboard shell.
 *
 * No navigation, because there is one page. Plausible's whole argument is that a dashboard you
 * have to navigate is a dashboard you stop opening — everything a practice needs about the week
 * fits on one screen, so there is nowhere to go.
 *
 * Shares the site's chrome — the same primary-container bar, the same label type — so it reads
 * as one product rather than an admin panel bolted onto a marketing site. Full bleed, because a
 * dense table has no business being squeezed into a narrow column on a wide monitor.
 *
 * The session is verified here as well as in proxy.ts. That is not redundancy for its own sake:
 * Next's guidance is that proxy suits optimistic redirects and should not be the only
 * authorisation gate, and a misconfigured matcher would otherwise expose every page below this
 * layout — all of which query with the service-role key.
 */

export const metadata = {
  title: 'Practice dashboard — Ashfield Dental',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUser())) redirect('/login');

  return (
    <div className="min-h-screen bg-page">
      <header className="w-full bg-primary-container shadow-lg shadow-secondary-container/20">
        <div className="flex w-full items-center gap-4 px-6 py-3 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary">
              A
            </span>
            <span className="font-display text-lg font-bold text-on-surface">Ashfield Dental</span>
          </Link>

          <span className="font-label hidden rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary uppercase sm:inline">
            Practice dashboard
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="font-label hidden rounded-full border border-primary/40 px-3 py-2 text-xs text-primary transition hover:bg-primary/10 md:block"
            >
              View site
            </Link>
            <form action="/api/admin/signout" method="post">
              <button
                type="submit"
                className="font-label rounded-full px-3 py-2 text-xs text-on-primary-container transition hover:bg-primary/10 hover:text-primary"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-10 sm:px-10 lg:px-16">{children}</main>
    </div>
  );
}
