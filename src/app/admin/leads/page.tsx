import { getLeads } from '@/lib/dashboard';

/**
 * Captured contacts.
 *
 * Each row carries the question that prompted it, so whoever rings back opens the conversation
 * knowing what the person actually wanted. A list of names and numbers with no context is a
 * chore; a list that says "she asked about sedation" is a warm call.
 */

export const dynamic = 'force-dynamic';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Contact details left with us</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        People who asked something our information couldn&rsquo;t answer and left details for a
        call back. The question they asked is shown alongside, so you know what they want before
        you dial.
      </p>

      {leads.length === 0 ? (
        <p className="mt-10 rounded-xl border border-outline-variant/30 bg-surface-mid px-5 py-8 text-center text-sm text-on-surface-variant">
          No contact details captured yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-2.5">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-xl border border-outline-variant/30 bg-surface-mid px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-medium">{lead.name}</p>
                <p className="text-[13px] whitespace-nowrap text-on-surface-variant/60">
                  {when(lead.createdAt)}
                </p>
              </div>

              <p className="mt-1 text-sm">
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {lead.email}
                  </a>
                ) : lead.phone ? (
                  <a
                    href={`tel:${lead.phone.replace(/\s/g, '')}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-on-surface-variant/60">No contact details</span>
                )}
              </p>

              {lead.reason && (
                <p className="mt-2.5 border-l-2 border-outline-variant/40 pl-3 text-sm text-on-surface-variant">
                  {lead.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
