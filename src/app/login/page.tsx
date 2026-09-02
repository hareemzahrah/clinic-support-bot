'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

/**
 * Practice sign-in.
 *
 * The demo credentials are printed on the form deliberately. This is a portfolio piece, and a
 * login page a prospective client cannot get past shows them nothing. The account is read-only
 * against fictional data, so publishing it costs nothing and the door is still real.
 */

const DEMO_EMAIL = 'demo@ashfielddental.example';
const DEMO_PASSWORD = 'ashfield-demo-2026';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true);
    setError('');

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    // refresh() so the proxy sees the new cookie before the dashboard renders.
    router.replace(params.get('next') || '/admin/gaps');
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cta text-sm font-semibold text-white">
          A
        </span>
        <span className="font-display text-lg font-semibold">Ashfield Dental</span>
      </div>

      <h1 className="font-display mt-8 text-2xl font-semibold">Practice sign in</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        The dashboard showing what patients asked and who left their details.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(email, password);
        }}
        className="mt-8 space-y-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="username"
          required
          disabled={busy}
          className="w-full rounded-xl border border-outline-variant/30 bg-surface-mid px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-cta/40 focus:ring-2 focus:ring-cta/20 focus:outline-none disabled:opacity-60"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
          disabled={busy}
          className="w-full rounded-xl border border-outline-variant/30 bg-surface-mid px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-cta/40 focus:ring-2 focus:ring-cta/20 focus:outline-none disabled:opacity-60"
        />

        {error && (
          <p className="rounded-lg bg-danger-container/40 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-cta px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cta-hover disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-cta/40 bg-surface-high px-4 py-3.5">
        <p className="text-sm font-medium">Viewing this as a demo?</p>
        <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
          The data is fictional and this account is read-only. Have a look around.
        </p>
        <button
          onClick={() => signIn(DEMO_EMAIL, DEMO_PASSWORD)}
          disabled={busy}
          className="mt-3 rounded-lg border border-cta/40 bg-surface-mid px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-surface-highest disabled:opacity-60"
        >
          Sign in to the demo
        </button>
        <p className="mt-2.5 font-mono text-[12px] text-on-surface-variant/60">
          {DEMO_EMAIL} · {DEMO_PASSWORD}
        </p>
      </div>

      <p className="mt-8 text-sm">
        <Link href="/" className="text-on-surface-variant/60 underline underline-offset-4 hover:text-on-surface">
          ← Back to the practice site
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
