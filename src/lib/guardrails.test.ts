/**
 * The daily limit's fallback.
 *
 * Worth testing because the obvious implementation is wrong in a way that only bites in
 * production: `Number(process.env.X ?? 20)` never falls back on an empty string, and
 * `Number('')` is 0 — every visitor refused on their first message. A deploy platform holding a
 * variable with a blank value is enough to cause it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

async function limitWith(value: string | undefined): Promise<number> {
  vi.resetModules();
  if (value === undefined) delete process.env.DAILY_IP_LIMIT;
  else process.env.DAILY_IP_LIMIT = value;
  const { DAILY_IP_LIMIT } = await import('./guardrails');
  return DAILY_IP_LIMIT;
}

afterEach(() => {
  delete process.env.DAILY_IP_LIMIT;
});

describe('DAILY_IP_LIMIT', () => {
  it('uses the value when set to a positive number', async () => {
    expect(await limitWith('500')).toBe(500);
  });

  it('falls back when unset', async () => {
    expect(await limitWith(undefined)).toBe(20);
  });

  it('falls back on an empty string rather than becoming zero', async () => {
    expect(await limitWith('')).toBe(20);
  });

  it('falls back on whitespace', async () => {
    expect(await limitWith('   ')).toBe(20);
  });

  it('falls back on a non-numeric value', async () => {
    expect(await limitWith('unlimited')).toBe(20);
  });

  it('falls back on zero, which would refuse everyone', async () => {
    expect(await limitWith('0')).toBe(20);
  });

  it('falls back on a negative value', async () => {
    expect(await limitWith('-5')).toBe(20);
  });
});
