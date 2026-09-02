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
      <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
        <p className="font-medium">Thanks — we have your details.</p>
        <p className="mt-1 text-teal-800">
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
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <p className="text-sm font-medium text-slate-900">Shall we get back to you?</p>
      <p className="mt-0.5 text-xs text-slate-500">
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email or phone number"
          maxLength={200}
          autoComplete="email"
          disabled={state === 'sending'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          No thanks
        </button>
      </div>
    </form>
  );
}
