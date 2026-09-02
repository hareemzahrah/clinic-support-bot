import {
  getDailyVolume,
  getGaps,
  getHourlyDistribution,
  getLeads,
  getSummary,
  type DayVolume,
  type HourBucket,
  type LeadRow,
} from '@/lib/dashboard';

/**
 * The practice dashboard, on one page.
 *
 * Laid out after Plausible, deliberately closely: a divided stat strip where the leading metric
 * is visibly selected, one area chart with a real Y-axis and gridlines, then side-by-side panels
 * of rows with a solid block behind each showing its share.
 *
 * Two of those carry the weight. The Y-axis, because a chart without one asks the reader to take
 * the shape on trust. And the block behind each row, because the question is always "which of
 * these matters most" — a block answers that before you have read a single number.
 */

export const dynamic = 'force-dynamic';

const CHART_HEIGHT = 260;

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * A stat in the top strip. The first is marked selected, as Plausible's is — it signals that the
 * chart below is showing this metric rather than an unrelated one.
 */
function Stat({
  label,
  value,
  sub,
  selected = false,
}: {
  label: string;
  value: string;
  sub?: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`border-outline-variant/25 px-5 py-4 not-last:border-r ${
        selected ? 'bg-surface-high' : ''
      }`}
    >
      <p
        className={`font-label text-[11px] uppercase ${
          selected ? 'text-on-surface' : 'text-on-surface-variant/70'
        }`}
      >
        {label}
      </p>
      <p className="font-display mt-1.5 text-[28px] leading-none font-bold text-on-surface">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-on-surface-variant/60">{sub}</p>}
    </div>
  );
}

/**
 * Area chart with gridlines and a labelled Y-axis.
 *
 * Drawn on a 0–100 viewBox with preserveAspectRatio="none" so it fills any width, and
 * vector-effect="non-scaling-stroke" so the stroke keeps an even weight instead of stretching
 * with the geometry — which is what made the earlier bar version look warped.
 */
function VolumeChart({ days }: { days: DayVolume[] }) {
  const totals = days.map((d) => d.answered + d.unanswered);
  const rawMax = Math.max(1, ...totals);
  // Round the axis up to a number a person would pick, so gridlines land on whole values.
  const step = rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : rawMax <= 60 ? 10 : 20;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => max - i * step);

  const point = (value: number, i: number) => {
    const x = days.length === 1 ? 50 : (i / (days.length - 1)) * 100;
    const y = 100 - (value / max) * 100;
    return `${x},${y}`;
  };

  const line = totals.map(point).join(' ');
  const area = `0,100 ${line} 100,100`;

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold">Questions per day</h2>
        <span className="font-label text-[11px] text-on-surface-variant/60 uppercase">
          Questions asked
        </span>
      </div>

      <div className="flex gap-3">
        {/* Y-axis sits outside the plot so labels stay upright and evenly spaced. */}
        <div
          className="flex w-7 flex-col justify-between text-right text-[11px] text-on-surface-variant/50 tabular-nums"
          style={{ height: CHART_HEIGHT }}
        >
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: CHART_HEIGHT }}>
          {ticks.map((tick, i) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-outline-variant/20"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Questions per day over the last fourteen days"
          >
            <defs>
              <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>

            <polygon points={area} fill="url(#volumeFill)" />
            <polyline
              points={line}
              fill="none"
              stroke="#8b7ff5"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Invisible hover targets, so each day gets a tooltip without the SVG carrying them. */}
          <div className="absolute inset-0 flex">
            {days.map((day) => (
              <div
                key={day.date}
                title={`${shortDate(day.date)} — ${day.answered + day.unanswered} asked, ${day.unanswered} unanswered`}
                className="flex-1 transition-colors hover:bg-primary/5"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 ml-10 flex justify-between text-[11px] text-on-surface-variant/50">
        <span>{shortDate(days[0]?.date)}</span>
        <span>{shortDate(days[Math.floor(days.length / 2)]?.date)}</span>
        <span>Today</span>
      </div>
    </section>
  );
}

/** Plausible's list row: a solid block sized to the value, sitting behind the label. */
function BarRow({
  label,
  value,
  max,
  meta,
  share,
}: {
  label: string;
  value: number;
  max: number;
  meta?: string;
  share?: string;
}) {
  return (
    <li className="relative flex items-center gap-3 px-3 py-[7px] text-sm">
      <span
        aria-hidden="true"
        className="absolute inset-y-[3px] left-2 rounded-sm bg-primary/12"
        style={{ width: `calc(${(value / max) * 100}% - 1rem)` }}
      />
      <span className="relative min-w-0 flex-1 truncate pl-1 text-on-surface">{label}</span>
      {meta && (
        <span className="relative shrink-0 text-[12px] text-on-surface-variant/50">{meta}</span>
      )}
      <span className="relative w-8 shrink-0 text-right font-medium tabular-nums">{value}</span>
      {share && (
        <span className="relative w-11 shrink-0 text-right text-[12px] text-on-surface-variant/50 tabular-nums">
          {share}
        </span>
      )}
    </li>
  );
}

function Panel({
  title,
  columns,
  children,
  footer,
  empty,
}: {
  title: string;
  columns: [string, string];
  children: React.ReactNode;
  footer?: string;
  empty?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-mid">
      <header className="border-b border-outline-variant/20 px-5 pt-4 pb-3">
        <h2 className="font-label text-[12px] tracking-wide text-on-surface uppercase">{title}</h2>
      </header>

      {empty ? (
        <p className="px-5 py-12 text-center text-sm text-on-surface-variant/60">Nothing yet.</p>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[12px] text-on-surface-variant/50">
            <span>{columns[0]}</span>
            <span>{columns[1]}</span>
          </div>
          <div className="flex-1 pb-2">{children}</div>
          {footer && (
            <p className="border-t border-outline-variant/20 px-4 py-2.5 text-[12px] text-on-surface-variant/50">
              {footer}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function HourChart({ hours }: { hours: HourBucket[] }) {
  const max = Math.max(1, ...hours.map((h) => h.count));
  const closed = hours.filter((h) => !h.open).reduce((n, h) => n + h.count, 0);

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold">When people ask</h2>
        <div className="flex items-center gap-5 text-[12px]">
          <span className="flex items-center gap-2 text-on-surface-variant">
            <span className="h-3 w-4 rounded-sm bg-cta" />
            We&rsquo;re closed — {closed} questions
          </span>
          <span className="flex items-center gap-2 text-on-surface-variant/70">
            <span className="h-3 w-4 rounded-sm bg-on-surface-variant/30" />
            Open
          </span>
        </div>
      </div>

      {/* h-full on each column is load-bearing: a percentage height needs a parent with a
          definite height, and without it every bar collapses to nothing. */}
      <div className="flex h-32 items-end gap-[3px]">
        {hours.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col justify-end">
            <div
              title={`${String(h.hour).padStart(2, '0')}:00 — ${h.count} question${h.count === 1 ? '' : 's'}`}
              className={`w-full rounded-t-sm transition-opacity hover:opacity-80 ${
                h.open ? 'bg-on-surface-variant/30' : 'bg-cta'
              }`}
              style={{ height: `${Math.max((h.count / max) * 100, 1.5)}%` }}
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
  const wants = [lead.preferredDay, lead.preferredTime].filter(Boolean).join(', ');

  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={`font-label mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] ${
          lead.isUrgent ? 'bg-danger/20 text-danger' : 'bg-primary-container text-primary'
        }`}
      >
        {initials(lead.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-on-surface">
            <span className="truncate font-medium">{lead.name}</span>
            {lead.isUrgent && (
              <span className="font-label shrink-0 rounded bg-danger/15 px-1 text-[9px] text-danger uppercase">
                Urgent
              </span>
            )}
          </p>
          <span className="shrink-0 text-[11px] text-on-surface-variant/50">
            {relative(lead.createdAt)}
          </span>
        </div>

        <p className="truncate text-[12px] text-on-surface-variant/60">
          {wants ? `Wants ${wants}` : (lead.reason ?? lead.email ?? lead.phone ?? '')}
        </p>
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

  const topGaps = gaps.slice(0, 9);
  const maxGap = Math.max(...gaps.map((g) => g.askCount), 1);
  const totalUnanswered = gaps.reduce((n, g) => n + g.askCount, 0);
  const topGap = gaps[0];
  const appointments = leads.filter((l) => l.preferredDay || l.preferredTime).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-bold">Ashfield Dental</h1>
          <span className="flex items-center gap-1.5 text-[13px] text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            assistant live
          </span>
        </div>
        <span className="font-label rounded-lg border border-outline-variant/40 px-3 py-1.5 text-[11px] text-on-surface-variant uppercase">
          Last 14 days
        </span>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-mid lg:grid-cols-4">
        <Stat
          label="Questions"
          value={String(summary.totalQuestions)}
          sub="asked by patients"
          selected
        />
        <Stat
          label="Answered"
          value={`${Math.round(summary.answeredRate * 100)}%`}
          sub="nobody picked up a phone"
        />
        <Stat
          label="Couldn't answer"
          value={String(summary.unansweredQuestions)}
          sub={`across ${gaps.length} topics`}
        />
        <Stat
          label="Contacts captured"
          value={String(leads.length)}
          sub={`${appointments} want an appointment`}
        />
      </div>

      {topGap && (
        <div className="rounded-xl border border-cta/40 bg-primary-container/30 px-5 py-3 text-[15px] leading-relaxed">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Questions we couldn't answer"
          columns={['Question', 'Times asked']}
          empty={gaps.length === 0}
          footer={
            gaps.length > topGaps.length
              ? `${totalUnanswered} unanswered across ${gaps.length} topics`
              : undefined
          }
        >
          <ul>
            {topGaps.map((gap) => (
              <BarRow
                key={gap.question}
                label={gap.question}
                value={gap.askCount}
                max={maxGap}
                meta={relative(gap.lastAskedAt)}
                share={`${Math.round((gap.askCount / totalUnanswered) * 100)}%`}
              />
            ))}
          </ul>
        </Panel>

        <Panel
          title="Contact details left with us"
          columns={['Patient', 'Left']}
          empty={leads.length === 0}
          footer={leads.length > 8 ? `${leads.length} waiting for a call back` : undefined}
        >
          <ul className="divide-y divide-outline-variant/15">
            {leads.slice(0, 8).map((lead) => (
              <LeadRowItem key={lead.id} lead={lead} />
            ))}
          </ul>
        </Panel>
      </div>

      <HourChart hours={hours} />
    </div>
  );
}
