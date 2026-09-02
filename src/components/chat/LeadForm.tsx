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
 * Handoff: contact details, and optionally an appointment request.
 *
 * The widget does not book. Booking means writing into whatever practice management system the
 * clinic runs, and there is no generic way to do that — so this takes a *request* instead. The
 * distinction is deliberate and worth keeping: a mocked booking flow collapses the moment
 * someone asks whether it really books, and takes the credibility of everything else with it.
 *
 * Appointment fields sit behind a checkbox rather than showing by default. Most people who reach
 * this point just want a call back, and four fields where two would do costs completions.
 */
export function LeadForm({ conversationId, reason, onDismiss }: LeadFormProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [wantsAppointment, setWantsAppointment] = useState(false);
  const [preferredDay, setPreferredDay] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState('');

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-cta/40 bg-primary-container/40 px-4 py-3 text-sm text-on-surface">
        <p className="font-medium">
          {wantsAppointment ? 'Thanks — we have your request.' : 'Thanks — we have your details.'}
        </p>
        <p className="mt-1 text-on-surface-variant">
          {wantsAppointment
            ? 'Reception will ring to confirm a time. Nothing is booked until they do.'
            : 'Someone from the practice will get back to you.'}{' '}
          For anything urgent, please ring 01632 960148.
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
      preferredDay: wantsAppointment ? preferredDay.trim() : '',
      preferredTime: wantsAppointment ? preferredTime.trim() : '',
      isUrgent: wantsAppointment && isUrgent,
    });

    if (ok) {
      setState('sent');
    } else {
      setState('editing');
      setError('That did not save. Please try again, or ring us on 01632 960148.');
    }
  }

  const field =
    'w-full rounded-lg border border-outline-variant/40 bg-surface-high px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-cta/60 focus:ring-2 focus:ring-cta/20 focus:outline-none disabled:opacity-60';

  const checkbox =
    'h-4 w-4 rounded border-outline-variant bg-surface-high accent-[#8b5cf6] focus:ring-2 focus:ring-cta/30';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-outline-variant/40 bg-surface-high px-4 py-3.5"
    >
      <p className="text-sm font-medium text-on-surface">Shall we get back to you?</p>
      <p className="mt-0.5 text-xs text-on-surface-variant/70">
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
          className={field}
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email or phone number"
          maxLength={200}
          autoComplete="email"
          disabled={state === 'sending'}
          className={field}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-on-surface-variant">
        <input
          type="checkbox"
          checked={wantsAppointment}
          onChange={(e) => setWantsAppointment(e.target.checked)}
          disabled={state === 'sending'}
          className={checkbox}
        />
        I&rsquo;d like an appointment
      </label>

      {wantsAppointment && (
        <div className="mt-3 space-y-2 border-l-2 border-cta/30 pl-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={preferredDay}
              onChange={(e) => setPreferredDay(e.target.value)}
              placeholder="Preferred day"
              maxLength={120}
              disabled={state === 'sending'}
              className={field}
            />
            <input
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              placeholder="Time of day"
              maxLength={120}
              disabled={state === 'sending'}
              className={field}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              disabled={state === 'sending'}
              className={checkbox}
            />
            It&rsquo;s urgent — I&rsquo;m in pain
          </label>

          <p className="text-[11px] leading-relaxed text-on-surface-variant/60">
            Reception will ring to confirm. Nothing is booked until they do.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-lg bg-cta px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cta-hover focus:ring-2 focus:ring-cta/30 focus:outline-none disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : wantsAppointment ? 'Request appointment' : 'Send'}
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
