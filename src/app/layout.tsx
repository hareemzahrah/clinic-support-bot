import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';

/**
 * The three faces from the Stitch export: Manrope for display and headings, Inter for body,
 * JetBrains Mono for the small uppercase labels on buttons and eyebrows.
 *
 * Loaded through next/font so they are self-hosted and preloaded — the exported HTML pulled
 * them from Google's CDN on every page view, which is a render-blocking round trip and a
 * third-party request the demo does not need.
 */
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['500'],
});

export const metadata: Metadata = {
  title: 'Ashfield Dental Practice — Milbury',
  description:
    'Specialist dental care in Milbury. Examinations, hygiene, white fillings, crowns, clear aligners and emergency appointments.',
};

// Typed explicitly rather than with Next's generated `LayoutProps` global, so `npm run
// typecheck` passes on a fresh clone before anything has been built.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${manrope.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-page text-on-surface">{children}</body>
    </html>
  );
}
