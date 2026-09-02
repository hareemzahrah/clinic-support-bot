/**
 * POST /api/lead — captures a visitor's contact details for the practice to follow up.
 *
 * This is the endpoint that makes the project worth money to a clinic. Every other feature
 * saves them phone calls; this one turns a question they could not answer into someone to
 * ring back. It fires when the bot could not answer, or when a visitor asks for a human.
 */

import { NextResponse } from 'next/server';
import { checkGuardrails, clientIp } from '@/lib/guardrails';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const MAX_NAME = 100;
const MAX_CONTACT = 200;
const MAX_REASON = 500;

/**
 * Deliberately permissive. A visitor may leave an email or a phone number, international
 * formats vary wildly, and a clinic would far rather receive a slightly malformed number they
 * can squint at than lose the enquiry to a validation error. We check it is plausibly one or
 * the other and leave it there.
 */
function looksLikeContact(value: string): boolean {
  const hasEmailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const digits = value.replace(/\D/g, '');
  return hasEmailShape || digits.length >= 7;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, MAX_REASON) : '';

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation.' }, { status: 400 });
  }
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: 'Please give us a name.' }, { status: 400 });
  }
  if (!contact || contact.length > MAX_CONTACT || !looksLikeContact(contact)) {
    return NextResponse.json(
      { error: 'Please give us an email address or a phone number so we can reply.' },
      { status: 400 },
    );
  }

  // Lead submission counts against the same per-IP budget as chat. Without this the endpoint
  // is an open, unauthenticated write into the clinic's leads table.
  try {
    const verdict = await checkGuardrails(clientIp(request.headers), 0);
    if (!verdict.allowed) {
      return NextResponse.json({ error: verdict.message }, { status: 429 });
    }
  } catch (cause) {
    console.error('[lead] guardrail check failed', cause);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  const supabase = getSupabase();

  // The conversation must exist. Without this check the endpoint accepts arbitrary rows keyed
  // to a made-up id, which is a spam funnel into the dashboard the clinic actually reads.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Unknown conversation.' }, { status: 400 });
  }

  const isEmail = contact.includes('@');

  const { error } = await supabase.from('leads').insert({
    conversation_id: conversationId,
    name,
    email: isEmail ? contact : null,
    phone: isEmail ? null : contact,
    reason: reason || null,
  });

  if (error) {
    console.error('[lead] insert failed', error);
    return NextResponse.json({ error: 'Could not save your details.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
