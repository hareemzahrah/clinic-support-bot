import Link from 'next/link';

/**
 * Practice dashboard shell.
 *
 * Deliberately plainer than the patient-facing site — this is a working tool someone opens on a
 * Monday morning, not a page meant to persuade anyone. Dense tables, quiet chrome, no hero.
 */

export const metadata = {
  title: 'Practice dashboard — Ashfield Dental',
  robots: { index: false, follow: false },
};

const TABS = [
  { href: '/admin/gaps', label: 'Gaps' },
  { href: '/admin/leads', label: 'Leads' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-tint">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-700 text-xs font-semibold text-paper">
              A
            </span>
            <span className="text-sm font-semibold">Practice dashboard</span>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition hover:bg-navy-50 hover:text-ink"
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/"
            className="ml-auto text-sm text-ink-faint underline underline-offset-4 transition hover:text-ink"
          >
            View the website
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
