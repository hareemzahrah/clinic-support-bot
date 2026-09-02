/**
 * Spend and abuse limits for the public endpoint.
 *
 * The widget is designed to be embedded on any website, so the chat endpoint is open to the
 * internet with no authentication. These limits are what make that safe to leave running on a
 * portfolio site: normal usage costs pennies a month, and no amount of hostile traffic can turn
 * it into a large bill.
 *
 * Three independent limits, deliberately. Each fails in a different way, so one being wrong or
 * bypassed does not expose the account:
 *
 *   1. Per-IP daily cap  — stops one visitor looping the endpoint
 *   2. Per-session cap   — stops one conversation running forever
 *   3. Console spend cap — the backstop, set outside this codebase, that nothing here can raise
 */

import { createHash } from 'node:crypto';
import { getSupabase } from './supabase';

/** Messages per IP per day. Generous for a real visitor, useless for a script. */
export const DAILY_IP_LIMIT = 20;

/** Messages per conversation before the widget offers a fresh start. */
export const SESSION_MESSAGE_LIMIT = 15;

/**
 * Visitor IPs are hashed, never stored raw — the clinic has no reason to hold them, and not
 * collecting them is one less thing to explain to a client.
 *
 * The salt keeps hashes from being reversible by rainbow table: the IPv4 space is small enough
 * to enumerate in seconds, so an unsalted SHA-256 of an IP address is not anonymous at all.
 */
function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'clinic-support-bot-dev-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export type GuardrailVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'daily_limit' | 'session_limit'; message: string };

/**
 * Extracts the client IP from proxy headers. Vercel sets x-forwarded-for; the leftmost entry is
 * the original client. Falls back to a constant so a missing header fails closed into a shared
 * bucket rather than opening an unlimited one.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function checkGuardrails(
  ip: string,
  sessionMessageCount: number,
): Promise<GuardrailVerdict> {
  if (sessionMessageCount >= SESSION_MESSAGE_LIMIT) {
    return {
      allowed: false,
      reason: 'session_limit',
      message:
        "We've covered a fair bit in this conversation. Start a new chat to carry on, or ring the practice on 01632 960148 and someone will help you directly.",
    };
  }

  // Atomic increment-and-test in one statement. Reading the count and then writing it would
  // race under concurrent requests, which is precisely the situation a rate limit exists for.
  const { data, error } = await getSupabase().rpc('increment_rate_limit', {
    p_ip_hash: hashIp(ip),
    p_limit: DAILY_IP_LIMIT,
  });

  if (error) {
    // Fail closed. A broken limiter must not become an open endpoint.
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  if (data === false) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message:
        "You've reached the daily limit for this demo. Please ring the practice on 01632 960148 if you need anything today.",
    };
  }

  return { allowed: true };
}
