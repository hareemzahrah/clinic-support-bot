/**
 * Queries behind the practice dashboard.
 *
 * Grouping happens in JavaScript rather than SQL. At this size — tens to low thousands of rows —
 * it is simpler to read and fast enough, and it keeps the schema stable so the migration does
 * not have to be re-run. A practice past a few thousand messages would want this as a Postgres
 * view with a GIN index on the question text; the shape of the result would not change.
 *
 * Paraphrases are not merged. "Do you offer sedation?" and "Do you do sedation? I'm terrified of
 * needles" appear as separate rows even though they are the same gap. Clustering them properly
 * means embedding each question and grouping by similarity, which is real work for a modest gain
 * — the counts already make the point, and a practice reading two adjacent sedation rows draws
 * the same conclusion.
 */

import { getSupabase } from './supabase';

export interface GapRow {
  question: string;
  askCount: number;
  lastAskedAt: string;
  /** How many of these arrived when the practice was closed. */
  outOfHoursCount: number;
  leadsCaptured: number;
}

export interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  preferredDay: string | null;
  preferredTime: string | null;
  isUrgent: boolean;
  createdAt: string;
}

export interface DayVolume {
  date: string;
  /** Midnight-anchored ISO date, for stable keys. */
  answered: number;
  unanswered: number;
}

export interface DashboardSummary {
  totalQuestions: number;
  unansweredQuestions: number;
  answeredRate: number;
  leads: number;
  outOfHoursShare: number;
}

/**
 * Weekday 08:30–17:30 is treated as open, which is close enough to the published hours for a
 * headline figure. The point being made is "a third of these arrived when nobody was here", and
 * that does not turn on whether Wednesday evening clinics are counted.
 */
function isOutOfHours(iso: string): boolean {
  const at = new Date(iso);
  const day = at.getDay();
  const hour = at.getHours();
  if (day === 0 || day === 6) return true;
  return hour < 8 || hour >= 18;
}

/** Lowercased, punctuation-stripped, collapsed whitespace — so casing alone does not split a row. */
function normalise(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getGaps(): Promise<GapRow[]> {
  const supabase = getSupabase();

  // The question is the user message immediately preceding an unanswered assistant reply, so
  // both are needed to pair them up.
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, role, content, was_answered, created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load gaps: ${error.message}`);

  const byConversation = new Map<string, typeof data>();
  for (const row of data ?? []) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(row);
    byConversation.set(row.conversation_id, list);
  }

  const leadsByConversation = await leadCountsByConversation();
  const grouped = new Map<string, GapRow>();

  for (const [conversationId, rows] of byConversation) {
    for (const [i, row] of rows.entries()) {
      if (row.role !== 'assistant' || row.was_answered !== false) continue;

      const question = rows[i - 1]?.role === 'user' ? rows[i - 1].content : null;
      if (!question) continue;

      const key = normalise(question);
      const existing = grouped.get(key);

      if (existing) {
        existing.askCount += 1;
        existing.outOfHoursCount += isOutOfHours(row.created_at) ? 1 : 0;
        existing.leadsCaptured += leadsByConversation.get(conversationId) ?? 0;
        if (row.created_at > existing.lastAskedAt) existing.lastAskedAt = row.created_at;
      } else {
        grouped.set(key, {
          question,
          askCount: 1,
          lastAskedAt: row.created_at,
          outOfHoursCount: isOutOfHours(row.created_at) ? 1 : 0,
          leadsCaptured: leadsByConversation.get(conversationId) ?? 0,
        });
      }
    }
  }

  return [...grouped.values()].sort(
    (a, b) => b.askCount - a.askCount || b.lastAskedAt.localeCompare(a.lastAskedAt),
  );
}

async function leadCountsByConversation(): Promise<Map<string, number>> {
  const { data } = await getSupabase().from('leads').select('conversation_id');
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }
  return counts;
}

export async function getLeads(): Promise<LeadRow[]> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('id, name, email, phone, reason, preferred_day, preferred_time, is_urgent, created_at')
    // Urgent first: a practice should see someone in pain before someone asking about whitening.
    .order('is_urgent', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load leads: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    reason: row.reason,
    preferredDay: row.preferred_day,
    preferredTime: row.preferred_time,
    isUrgent: row.is_urgent ?? false,
    createdAt: row.created_at,
  }));
}

export async function getSummary(): Promise<DashboardSummary> {
  const supabase = getSupabase();

  const [{ count: total }, { count: unanswered }, { count: leads }] = await Promise.all([
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('was_answered', false),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
  ]);

  const { data: timestamps } = await supabase
    .from('messages')
    .select('created_at')
    .eq('role', 'user');

  const outOfHours = (timestamps ?? []).filter((r) => isOutOfHours(r.created_at)).length;
  const totalQuestions = total ?? 0;

  return {
    totalQuestions,
    unansweredQuestions: unanswered ?? 0,
    answeredRate: totalQuestions ? 1 - (unanswered ?? 0) / totalQuestions : 0,
    leads: leads ?? 0,
    outOfHoursShare: totalQuestions ? outOfHours / totalQuestions : 0,
  };
}


/**
 * Question volume per day for the last two weeks, split by whether the documents answered.
 *
 * The single most useful thing on the page. A table of gaps says what is missing; this says
 * whether the problem is growing, and it makes the out-of-hours argument visible — the days
 * with the tallest unanswered bars are the ones worth acting on first.
 */
export async function getDailyVolume(days = 14): Promise<DayVolume[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select('created_at, was_answered')
    .eq('role', 'assistant')
    .gte('created_at', since.toISOString());

  if (error) throw new Error(`Could not load volume: ${error.message}`);

  // Seed every day so a quiet day renders as a gap in the chart rather than vanishing and
  // silently compressing the timeline.
  const buckets = new Map<string, DayVolume>();
  for (let i = 0; i < days; i++) {
    const at = new Date(since);
    at.setDate(since.getDate() + i);
    const key = at.toISOString().slice(0, 10);
    buckets.set(key, { date: key, answered: 0, unanswered: 0 });
  }

  for (const row of data ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.was_answered === false) bucket.unanswered += 1;
    else bucket.answered += 1;
  }

  return [...buckets.values()];
}

export interface HourBucket {
  hour: number;
  count: number;
  open: boolean;
}

/**
 * When questions arrive, by hour of day.
 *
 * Turns the out-of-hours headline from a percentage into something you can see: the bars either
 * side of the shaded opening-hours band are the enquiries that would have reached an answerphone.
 */
export async function getHourlyDistribution(): Promise<HourBucket[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('created_at')
    .eq('role', 'user');

  if (error) throw new Error(`Could not load hourly distribution: ${error.message}`);

  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    open: hour >= 8 && hour < 18,
  }));

  for (const row of data ?? []) {
    buckets[new Date(row.created_at).getHours()].count += 1;
  }

  return buckets;
}
