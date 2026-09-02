import {
  getDailyVolume,
  getGaps,
  getHourlyDistribution,
  getLeads,
  getSummary,
  type DayVolume,
  type GapRow,
  type HourBucket,
  type LeadRow,
} from '@/lib/dashboard';

/**
 * The practice dashboard, on one page.
 *
 * Modelled on Plausible: no sidebar, no tabs, no drilling. A stat row, one chart that carries
 * the story, then panels of list rows with a proportional bar behind each. Everything a practice
 * needs is on one screen, which is the whole reason Plausible's dashboard works — you open it,
 * you understand the week, you close it.
 *
 * The bar-behind-the-row is the pattern doing the real work. The question is always "which of
 * these matters most", and a bar answers that at a glance where a column of numbers makes you
 * do the arithmetic yourself.
 */

export const dynamic = 'force-dynamic';

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Stat({
  value,
  label,
  sub,
  accent = false,
}: {
  value: string;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-outline-variant/30 px-6 py-5 not-last:border-r">
      <p className="font-label text-[11px] text-on-surface-variant/70 uppercase">{label}</p>
      <p
        className={`font-display mt-1.5 text-3xl font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[12px] text-on-surface-variant/60">{sub}</p>}
    </div>
  );
}

/** The Plausible list row: label and value, with a bar filling the row behind them. */
function BarRow({
  label,
  value,
  max,
  meta,
  tone = 'default',
}: {
  label: string;
  value: number;
  max: number;
  meta?: string;
  tone?: 'default' | 'accent';
}) {
  return (
    <li className="relative flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-1 rounded ${
          tone === 'accent' ? 'bg-cta/20' : 'bg-primary/10'
        }`}
        style={{ width: `calc(${(value / max) * 100}% - 0.5rem)` }}
      />
      <span className="relative min-w-0 flex-1 truncate text-on-surface">{label}</span>
      {meta && (
        <span className="relative shrink-0 text-[12px] text-on-surface-variant/60">{meta}</span>
      )}
      <span className="relative w-8 shrink-0 text-right font-semibold tabular-nums">{value}</span>
    </li>
  );
}

function Panel({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-mid">
      <header className="flex items-baseline justify-between gap-3 border-b border-outline-variant/20 px-5 py-3.5">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        {subtitle && (
          <span className="font-label text-[11px] text-on-surface-variant/60 uppercase">
            {subtitle}
          </span>
        )}
      </header>
      {empty ? (
        <p className="px-5 py-10 text-center text-sm text-on-surface-variant/60">Nothing yet.</p>
      ) : (
        <div className="py-1.5">{children}</div>
      )}
    </section>
  );
}

function VolumeChart({ days }: { days: DayVolume[] }) {
  const max = Math.max(1, ...days.map((d) => d.answered + d.unanswered));

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold">Questions per day</h2>
        <div className="flex items-center gap-4 text-[12px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" /> Answered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-cta" /> Couldn&rsquo;t answer
          </span>
        </div>
      </div>

      {/* 0–100 viewBox with preserveAspectRatio="none" so it stretches to any column width
          without measuring — no client component, no resize listener. */}
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label="Questions per day, answered and unanswered"
      >
        {days.map((day, i) => {
          const barWidth = 100 / days.length;
          const answered = (day.answered / max) * 38;
          const unanswered = (day.unanswered / max) * 38;
          const x = i * barWidth + barWidth * 0.2;
          const w = barWidth * 0.6;

          return (
            <g key={day.date}>
              <title>{`${day.date}: ${day.answered + day.unanswered} asked, ${day.unanswered} unanswered`}</title>
              <rect x={x} y={40 - answered} width={w} height={answered} rx={0.4} className="fill-primary/40" />
              <rect
                x={x}
                y={40 - answered - unanswered}
                width={w}
                height={unanswered}
                rx={0.4}
                className="fill-cta"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-on-surface-variant/50">
        <span>
          {new Date(days[0]?.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
        <span>Today</span>
      </div>
    </section>
  );
}

function HourChart({ hours }: { hours: HourBucket[] }) {
  const max = Math.max(1, ...hours.map((h) => h.count));

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold">When people ask</h2>
        <span className="font-label text-[11px] text-on-surface-variant/60 uppercase">
          Shaded = we&rsquo;re open
        </span>
      </div>

      <div className="flex h-32 items-end gap-[3px]">
        {hours.map((h) => (
          <div key={h.hour} className="group relative flex flex-1 flex-col justify-end">
            <div
              title={`${String(h.hour).padStart(2, '0')}:00 — ${h.count} questions`}
              className={`w-full rounded-t-sm ${h.open ? 'bg-primary/35' : 'bg-cta'}`}
              style={{ height: `${Math.max((h.count / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-on-surface-variant/50">
        <span>00:00</span>
        <span>08:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function LeadRowItem({ lead }: { lead: LeadRow }) {
  const wantsAppointment = Boolean(lead.preferredDay || lead.preferredTime);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={`font-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] ${
          lead.isUrgent ? 'bg-danger/20 text-danger' : 'bg-primary-container text-primary'
        }`}
      >
        {initials(lead.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-on-surface">
            <span className="truncate">{lead.name}</span>
            {lead.isUrgent && (
              <span className="font-label shrink-0 rounded bg-danger/15 px-1.5 text-[10px] text-danger uppercase">
                Urgent
              </span>
            )}
          </p>
          <span className="shrink-0 text-[11px] text-on-surface-variant/50">
            {relative(lead.createdAt)}
          </span>
        </div>

        <a
          href={lead.email ? `mailto:${lead.email}` : `tel:${(lead.phone ?? '').replace(/\s/g, '')}`}
          className="text-[13px] text-primary transition hover:text-secondary"
        >
          {lead.email ?? lead.phone ?? 'No contact details'}
        </a>

        {wantsAppointment && (
          <p className="mt-1 text-[12px] text-on-surface-variant">
            <span className="font-label mr-1.5 text-[10px] text-primary uppercase">Wants</span>
            {[lead.preferredDay, lead.preferredTime].filter(Boolean).join(', ')}
          </p>
        )}

        {lead.reason && (
          <p className="mt-1 truncate text-[12px] text-on-surface-variant/60">{lead.reason}</p>
        )}
      </div>
    </li>
  );
}

export default async function DashboardPage() {
  const [gaps, summary, days, hours, leads] = await Promise.all([
    getGaps(),
    getSummary(),
    getDailyVolume(),
    getHourlyDistribution(),
    getLeads(),
  ]);

  const topGaps = gaps.slice(0, 8);
  const maxGap = Math.max(...gaps.map((g) => g.askCount), 1);
  const topGap = gaps[0];
  const appointments = leads.filter((l) => l.preferredDay || l.preferredTime).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Ashfield Dental</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            What patients asked, and what we couldn&rsquo;t answer
          </p>
        </div>
        <span className="font-label rounded-full border border-outline-variant/40 px-3 py-1.5 text-[11px] text-on-surface-variant uppercase">
          Last 14 days
        </span>
      </div>

      {/* One divided strip rather than four separate cards — Plausible's stat row, and it reads
          as a single fact about the week instead of four unrelated boxes. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-mid lg:grid-cols-4">
        <Stat value={String(summary.totalQuestions)} label="Questions" sub="asked by patients" />
        <Stat
          value={`${Math.round(summary.answeredRate * 100)}%`}
          label="Answered"
          sub="without anyone picking up"
        />
        <Stat value={String(leads.length)} label="Contacts" sub={`${appointments} want an appointment`} accent />
        <Stat
          value={`${Math.round(summary.outOfHoursShare * 100)}%`}
          label="Out of hours"
          sub="evenings and weekends"
        />
      </div>

      {topGap && (
        <div className="rounded-xl border border-cta/40 bg-primary-container/30 px-5 py-3.5 text-[15px] leading-relaxed">
          <span className="font-label mr-2 text-[11px] text-primary uppercase">Act on this</span>
          <span className="font-semibold text-on-surface">
            {topGap.askCount} people asked &ldquo;{topGap.question}&rdquo;
          </span>
          <span className="text-on-surface-variant">
            {' '}
            and it isn&rsquo;t covered anywhere on the site
            {topGap.outOfHoursCount > 0 && ` — ${topGap.outOfHoursCount} outside opening hours`}.
          </span>
        </div>
      )}

      <VolumeChart days={days} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Questions we couldn't answer"
          subtitle={`${gaps.length} topics`}
          empty={gaps.length === 0}
        >
          <ul>
            {topGaps.map((gap: GapRow) => (
              <BarRow
                key={gap.question}
                label={gap.question}
                value={gap.askCount}
                max={maxGap}
                meta={relative(gap.lastAskedAt)}
                tone="accent"
              />
            ))}
          </ul>
          {gaps.length > topGaps.length && (
            <p className="px-4 pt-1 pb-2 text-[12px] text-on-surface-variant/50">
              and {gaps.length - topGaps.length} more asked once or twice
            </p>
          )}
        </Panel>

        <Panel
          title="Contact details left with us"
          subtitle={`${leads.length} waiting`}
          empty={leads.length === 0}
        >
          <ul className="divide-y divide-outline-variant/15">
            {leads.slice(0, 6).map((lead) => (
              <LeadRowItem key={lead.id} lead={lead} />
            ))}
          </ul>
          {leads.length > 6 && (
            <p className="px-4 pt-1 pb-2 text-[12px] text-on-surface-variant/50">
              and {leads.length - 6} more
            </p>
          )}
        </Panel>
      </div>

      <HourChart hours={hours} />
    </div>
  );
}
