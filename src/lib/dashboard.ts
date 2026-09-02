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
  createdAt: string;
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
    .select('id, name, email, phone, reason, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load leads: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    reason: row.reason,
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
