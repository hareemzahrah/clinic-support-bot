import { getGaps, getSummary } from '@/lib/dashboard';

/**
 * The gaps screen — questions the practice's own documents could not answer.
 *
 * This is the screen the product is really for. Every chatbot dashboard shows conversation
 * counts; this one hands the practice a content to-do list written by their own patients, in
 * frequency order. "Forty-one people asked about sedation and your website does not mention it"
 * is an argument for keeping the thing installed.
 */

export const dynamic = 'force-dynamic';

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  // Clock skew between the database and the reader should never render as "-1 days ago".
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3.5">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">{label}</p>
      {hint && <p className="mt-1 text-[12px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export default async function GapsPage() {
  const [gaps, summary] = await Promise.all([getGaps(), getSummary()]);
  const totalUnanswered = gaps.reduce((n, g) => n + g.askCount, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Questions we couldn&rsquo;t answer</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Patients asked these and our website didn&rsquo;t have the answer. The ones at the top
        are costing the most phone calls — add them to the practice information and the
        assistant will answer them from then on.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={String(summary.totalQuestions)} label="Questions asked" hint="last 14 days" />
        <Stat
          value={`${Math.round(summary.answeredRate * 100)}%`}
          label="Answered instantly"
        />
        <Stat value={String(summary.leads)} label="Contact details captured" />
        <Stat
          value={`${Math.round(summary.outOfHoursShare * 100)}%`}
          label="Asked out of hours"
          hint="evenings and weekends"
        />
      </div>

      {gaps.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-paper px-5 py-8 text-center text-sm text-ink-soft">
          Nothing here — every question so far was answered from the practice information.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] tracking-wide text-ink-faint uppercase">
                <th className="px-5 py-3 font-medium">Question</th>
                <th className="px-3 py-3 text-right font-medium">Asked</th>
                <th className="px-3 py-3 text-right font-medium">Out of hours</th>
                <th className="px-3 py-3 text-right font-medium">Leads</th>
                <th className="px-5 py-3 text-right font-medium">Last asked</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.question} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-3.5">{gap.question}</td>
                  <td className="px-3 py-3.5 text-right">
                    <span
                      className={
                        gap.askCount >= 4
                          ? 'rounded-md bg-navy-700 px-2 py-0.5 text-[12px] font-medium text-paper'
                          : 'text-ink-soft'
                      }
                    >
                      {gap.askCount}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-soft">
                    {gap.outOfHoursCount || '—'}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-soft">
                    {gap.leadsCaptured || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap text-ink-faint">
                    {relative(gap.lastAskedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[13px] text-ink-faint">
        {totalUnanswered} unanswered {totalUnanswered === 1 ? 'question' : 'questions'} across{' '}
        {gaps.length} {gaps.length === 1 ? 'topic' : 'topics'}. Similar wordings are listed
        separately.
      </p>
    </div>
  );
}
