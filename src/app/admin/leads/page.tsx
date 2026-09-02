import { getLeads } from '@/lib/dashboard';

/**
 * Captured contacts.
 *
 * Each card carries the question that prompted it, so whoever rings back opens with what the
 * person actually wanted. A list of names and numbers is a chore; a list that says "she asked
 * about sedation" is a warm call, and that difference is most of the value here.
 *
 * Grouped by day because these get worked through in sittings — someone sits down on Monday and
 * deals with the weekend's enquiries.
 */

export const dynamic = 'force-dynamic';

function dayLabel(iso: string): string {
  const at = new Date(iso);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((midnight.getTime() - at.setHours(0, 0, 0, 0)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function outOfHours(iso: string): boolean {
  const at = new Date(iso);
  const day = at.getDay();
  return day === 0 || day === 6 || at.getHours() < 8 || at.getHours() >= 18;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function LeadsPage() {
  const leads = await getLeads();

  const byDay = new Map<string, typeof leads>();
  for (const lead of leads) {
    const key = dayLabel(lead.createdAt);
    byDay.set(key, [...(byDay.get(key) ?? []), lead]);
  }

  const afterHours = leads.filter((l) => outOfHours(l.createdAt)).length;
  const appointments = leads.filter((l) => l.preferredDay || l.preferredTime).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Contact details left with us</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-on-surface-variant">
          People who asked something our information couldn&rsquo;t answer and left details for a
          call back. The question they asked is shown alongside, so you know what they want
          before you dial.
        </p>
      </div>

      {leads.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-3">
          <div className="rounded-xl border border-cta/40 bg-primary-container/40 p-5">
            <p className="font-display text-3xl font-bold text-primary">{leads.length}</p>
            <p className="font-label mt-2 text-[11px] text-on-surface-variant uppercase">
              Waiting for a call
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
            <p className="font-display text-3xl font-bold">{appointments}</p>
            <p className="font-label mt-2 text-[11px] text-on-surface-variant uppercase">
              Appointment requests
            </p>
            <p className="mt-1 text-[12px] text-on-surface-variant/60">to ring back and confirm</p>
          </div>
          <div className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
            <p className="font-display text-3xl font-bold">{afterHours}</p>
            <p className="font-label mt-2 text-[11px] text-on-surface-variant uppercase">
              Left out of hours
            </p>
            <p className="mt-1 text-[12px] text-on-surface-variant/60">
              would have reached the answerphone
            </p>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <p className="rounded-xl border border-outline-variant/30 bg-surface-mid px-5 py-10 text-center text-sm text-on-surface-variant">
          No contact details captured yet.
        </p>
      ) : (
        <div className="space-y-8">
          {[...byDay.entries()].map(([day, dayLeads]) => (
            <section key={day}>
              <h2 className="font-label mb-3 text-[11px] text-on-surface-variant/60 uppercase">
                {day} · {dayLeads.length}
              </h2>

              <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {dayLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="group rounded-xl border border-outline-variant/30 bg-surface-mid p-5 transition-colors hover:border-cta/40"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`font-label flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] ${
                          lead.isUrgent
                            ? 'bg-danger/20 text-danger'
                            : 'bg-primary-container text-primary'
                        }`}
                      >
                        {initials(lead.name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="flex items-center gap-2 font-semibold text-on-surface">
                            {lead.name}
                            {lead.isUrgent && (
                              <span className="font-label rounded-md bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger uppercase">
                                Urgent
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] whitespace-nowrap text-on-surface-variant/60">
                            {time(lead.createdAt)}
                            {outOfHours(lead.createdAt) && (
                              <span className="ml-1.5 text-primary">· after hours</span>
                            )}
                          </p>
                        </div>

                        <a
                          href={
                            lead.email
                              ? `mailto:${lead.email}`
                              : `tel:${(lead.phone ?? '').replace(/\s/g, '')}`
                          }
                          className="mt-0.5 inline-block text-sm text-primary underline underline-offset-4 transition hover:text-secondary"
                        >
                          {lead.email ?? lead.phone ?? 'No contact details'}
                        </a>
                      </div>
                    </div>

                    {(lead.preferredDay || lead.preferredTime) && (
                      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-cta/30 bg-primary-container/30 px-3 py-2.5 text-[13px] text-on-surface">
                        <span className="font-label text-[10px] text-primary uppercase">
                          Wants an appointment
                        </span>
                        <span>{[lead.preferredDay, lead.preferredTime].filter(Boolean).join(', ')}</span>
                      </p>
                    )}

                    {lead.reason && (
                      <p className="mt-3 rounded-lg bg-surface-high px-3 py-2.5 text-[13px] leading-relaxed text-on-surface-variant">
                        <span className="font-label mr-1.5 text-[10px] text-on-surface-variant/50 uppercase">
                          Asked
                        </span>
                        {lead.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
