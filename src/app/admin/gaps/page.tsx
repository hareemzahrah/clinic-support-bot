import { getDailyVolume, getGaps, getSummary, type DayVolume, type GapRow } from '@/lib/dashboard';

/**
 * The gaps screen — questions the practice's own documents could not answer.
 *
 * This is the screen the product is really for. Every chatbot dashboard shows conversation
 * counts; this one hands the practice a to-do list written by their own patients, in frequency
 * order, with the out-of-hours share alongside it.
 *
 * The chart earns its place rather than decorating: a table says what is missing, the chart says
 * whether it is getting worse, and the two together are the argument for keeping the thing
 * installed. Drawn as inline SVG from the same query — no chart library, nothing to load.
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

function Stat({
  value,
  label,
  hint,
  accent = false,
}: {
  value: string;
  label: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? 'border-cta/40 bg-primary-container/40'
          : 'border-outline-variant/30 bg-surface-mid'
      }`}
    >
      <p className={`font-display text-3xl font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}>
        {value}
      </p>
      <p className="font-label mt-2 text-[11px] text-on-surface-variant uppercase">{label}</p>
      {hint && <p className="mt-1 text-[12px] text-on-surface-variant/60">{hint}</p>}
    </div>
  );
}

/**
 * Fourteen days of question volume, answered beneath unanswered.
 *
 * Inline SVG on a 0–100 viewBox with `preserveAspectRatio="none"` so it stretches to whatever
 * width the column has without needing to know it — no measuring, no client component, no
 * resize listener.
 */
function VolumeChart({ days }: { days: DayVolume[] }) {
  const max = Math.max(1, ...days.map((d) => d.answered + d.unanswered));
  const barWidth = 100 / days.length;

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Questions per day</h2>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">Last 14 days</p>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" /> Answered
          </span>
          <span className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="h-2.5 w-2.5 rounded-sm bg-cta" /> Couldn&rsquo;t answer
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Daily question volume, answered and unanswered"
      >
        {days.map((day, i) => {
          const total = day.answered + day.unanswered;
          const answeredHeight = (day.answered / max) * 38;
          const unansweredHeight = (day.unanswered / max) * 38;
          const x = i * barWidth + barWidth * 0.18;
          const w = barWidth * 0.64;

          return (
            <g key={day.date}>
              <title>{`${day.date}: ${total} asked, ${day.unanswered} unanswered`}</title>
              <rect
                x={x}
                y={40 - answeredHeight}
                width={w}
                height={answeredHeight}
                rx={0.4}
                className="fill-primary/40"
              />
              <rect
                x={x}
                y={40 - answeredHeight - unansweredHeight}
                width={w}
                height={unansweredHeight}
                rx={0.4}
                className="fill-cta"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-on-surface-variant/50">
        <span>{new Date(days[0]?.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function GapTable({ gaps }: { gaps: GapRow[] }) {
  const max = Math.max(...gaps.map((g) => g.askCount), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-mid">
      <table className="w-full text-sm">
        <thead>
          <tr className="font-label border-b border-outline-variant/30 text-left text-[11px] text-on-surface-variant/60 uppercase">
            <th className="px-5 py-3 font-medium">Question</th>
            <th className="w-[180px] px-3 py-3 font-medium">Times asked</th>
            <th className="px-3 py-3 text-right font-medium">Out of hours</th>
            <th className="px-3 py-3 text-right font-medium">Leads</th>
            <th className="px-5 py-3 text-right font-medium">Last asked</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr
              key={gap.question}
              className="border-b border-outline-variant/20 transition-colors last:border-0 hover:bg-surface-high/50"
            >
              <td className="px-5 py-4 font-medium text-on-surface">{gap.question}</td>

              {/* A bar rather than a bare number: the whole point of this table is relative
                  weight, and a column of digits makes you do that comparison in your head. */}
              <td className="px-3 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-highest">
                    <div
                      className="h-full rounded-full bg-cta"
                      style={{ width: `${(gap.askCount / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-[13px] font-semibold text-on-surface tabular-nums">
                    {gap.askCount}
                  </span>
                </div>
              </td>

              <td className="px-3 py-4 text-right text-on-surface-variant tabular-nums">
                {gap.outOfHoursCount || <span className="text-on-surface-variant/30">—</span>}
              </td>
              <td className="px-3 py-4 text-right tabular-nums">
                {gap.leadsCaptured ? (
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[12px] font-medium text-primary">
                    {gap.leadsCaptured}
                  </span>
                ) : (
                  <span className="text-on-surface-variant/30">—</span>
                )}
              </td>
              <td className="px-5 py-4 text-right whitespace-nowrap text-on-surface-variant/60">
                {relative(gap.lastAskedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GapsPage() {
  const [gaps, summary, days] = await Promise.all([getGaps(), getSummary(), getDailyVolume()]);
  const totalUnanswered = gaps.reduce((n, g) => n + g.askCount, 0);
  const topGap = gaps[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Questions we couldn&rsquo;t answer</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-on-surface-variant">
          Patients asked these and our practice information didn&rsquo;t have the answer. The
          ones at the top are costing the most phone calls.
        </p>
      </div>

      {/* The one-sentence version of the whole page, for someone who reads nothing else. */}
      {topGap && (
        <div className="rounded-xl border border-cta/40 bg-primary-container/30 px-5 py-4">
          <p className="text-[15px] leading-relaxed">
            <span className="font-label mr-2 text-[11px] text-primary uppercase">Act on this</span>
            <span className="font-semibold text-on-surface">
              {topGap.askCount} people asked &ldquo;{topGap.question}&rdquo;
            </span>
            <span className="text-on-surface-variant">
              {' '}
              and it isn&rsquo;t covered anywhere on the site
              {topGap.outOfHoursCount > 0 &&
                ` — ${topGap.outOfHoursCount} of them outside opening hours`}
              .
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat value={String(summary.totalQuestions)} label="Questions asked" hint="last 14 days" />
        <Stat
          value={`${Math.round(summary.answeredRate * 100)}%`}
          label="Answered instantly"
          hint="without anyone picking up"
        />
        <Stat value={String(summary.leads)} label="Contacts captured" accent />
        <Stat
          value={`${Math.round(summary.outOfHoursShare * 100)}%`}
          label="Asked out of hours"
          hint="evenings and weekends"
        />
      </div>

      <VolumeChart days={days} />

      {gaps.length === 0 ? (
        <p className="rounded-xl border border-outline-variant/30 bg-surface-mid px-5 py-10 text-center text-sm text-on-surface-variant">
          Nothing here — every question so far was answered from the practice information.
        </p>
      ) : (
        <div>
          <GapTable gaps={gaps} />
          <p className="mt-3 text-[13px] text-on-surface-variant/60">
            {totalUnanswered} unanswered {totalUnanswered === 1 ? 'question' : 'questions'} across{' '}
            {gaps.length} {gaps.length === 1 ? 'topic' : 'topics'}. Similar wordings are listed
            separately.
          </p>
        </div>
      )}
    </div>
  );
}
