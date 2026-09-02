/**
 * Shared retry for transient Anthropic failures.
 *
 * `overloaded_error` (529) is the one that actually turns up — the API is momentarily busy and
 * the same request succeeds a second later. It has cost us a broken reply in the browser and a
 * half-finished test run, so anything that calls the API goes through here.
 */

export function isTransient(cause: unknown): boolean {
  const status = (cause as { status?: number })?.status;
  const type = (cause as { error?: { error?: { type?: string } } })?.error?.error?.type;
  return (
    type === 'overloaded_error' ||
    status === 429 ||
    status === 408 ||
    (typeof status === 'number' && status >= 500)
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `attempt`, retrying transient failures with exponential backoff. */
export async function withRetry<T>(attempt: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastError: unknown;

  for (let n = 1; n <= maxAttempts; n++) {
    try {
      return await attempt();
    } catch (cause) {
      lastError = cause;
      if (n === maxAttempts || !isTransient(cause)) throw cause;
      await sleep(600 * 2 ** (n - 1));
    }
  }

  throw lastError;
}
