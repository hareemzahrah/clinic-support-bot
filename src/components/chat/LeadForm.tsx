'use client';

import { useState } from 'react';
import { submitLead } from '@/lib/chat-client';

interface LeadFormProps {
  conversationId: string;
  /** The question that could not be answered, passed through so the practice has context. */
  reason: string;
  onDismiss: () => void;
}

/**
 * Contact capture, shown inline after the bot could not answer.
 *
 * Asks for a name and one contact method and nothing else. Every extra field costs completions,
 * and a clinic can find out the rest when they ring back — the only job here is turning a
 * question the documents could not answer into someone to call.
 */
export function LeadForm({ conversationId, reason, onDismiss }: LeadFormProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent' | 'error'>('editing');
  const [error, setError] = useState('');

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-cta/40 bg-primary-container/40 px-4 py-3 text-sm text-on-surface">
        <p className="font-medium">Thanks — we have your details.</p>
        <p className="mt-1 text-on-surface-variant">
          Someone from the practice will get back to you. For anything urgent, please ring 01632
          960148.
        </p>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !contact.trim()) {
      setError('We need a name and a way to reach you.');
      return;
    }

    setState('sending');
    setError('');

    const ok = await submitLead(conversationId, {
      name: name.trim(),
      contact: contact.trim(),
      reason,
    });

    if (ok) {
      setState('sent');
    } else {
      setState('error');
      setError('That did not save. Please try again, or ring us on 01632 960148.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-outline-variant/40 bg-surface-high px-4 py-3 shadow-sm"
    >
      <p className="text-sm font-medium text-on-surface">Shall we get back to you?</p>
      <p className="mt-0.5 text-xs text-on-surface-variant/60">
        Leave your details and the practice will follow this up.
      </p>

      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
          autoComplete="name"
          disabled={state === 'sending'}
          className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm text-fg placeholder:text-on-surface-variant/60 focus:border-cta/60 focus:ring-2 focus:ring-cta/20 focus:outline-none disabled:bg-surface-highest"
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email or phone number"
          maxLength={200}
          autoComplete="email"
          disabled={state === 'sending'}
          className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-sm text-fg placeholder:text-on-surface-variant/60 focus:border-cta/60 focus:ring-2 focus:ring-cta/20 focus:outline-none disabled:bg-surface-highest"
        />
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-lg bg-cta px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cta-hover focus:ring-2 focus:ring-cta/30 focus:outline-none disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant/60 transition hover:bg-surface-highest hover:text-on-surface"
        >
          No thanks
        </button>
      </div>
    </form>
  );
}
