import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

/**
 * A serif for headings and a neutral sans for everything else.
 *
 * Fraunces gives the practice some warmth and age — a dental surgery is a place you trust, not
 * a startup — while Inter keeps prices, opening hours and policy text plainly legible, which is
 * what people actually come to a clinic website for.
 */
// `axes` is only accepted when the weight is left variable, so the optical-size and softness
// axes are traded away for explicit weights. Two fixed weights is what the design actually uses.
const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '600'],
});

const body = Inter({
  variable: '--font-body',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Ashfield Dental Practice — Milbury',
  description:
    'NHS and private dentistry in Milbury. Examinations, hygiene, white fillings, crowns, clear aligners and emergency appointments.',
};

// Typed explicitly rather than with Next's generated `LayoutProps` global, so `npm run
// typecheck` passes on a fresh clone before anything has been built.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
