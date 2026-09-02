/**
 * Browser-side client for the SSE chat endpoint.
 *
 * Kept separate from the React components so the transport can be tested and reasoned about on
 * its own. The wire format is three event types: `text` (a delta), `done` (verdict, citations),
 * and `error`.
 */

export interface Citation {
  title: string;
  heading: string;
}

export interface ChatDone {
  answered: boolean;
  citations: Citation[];
  conversationId: string;
  offerHandoff: boolean;
}

export interface ChatHandlers {
  onText: (delta: string) => void;
  onDone: (done: ChatDone) => void;
  onError: (message: string) => void;
}

/**
 * A session id, persisted so a returning visitor continues the same conversation.
 *
 * Wrapped in try/catch because localStorage throws outright in some contexts — private windows
 * with site data blocked, or an iframe whose storage is partitioned. Falling back to an
 * in-memory id keeps the widget working; the visitor just starts fresh.
 */
let memorySessionId: string | null = null;

export function getSessionId(): string {
  const KEY = 'clinic-bot-session';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}

export function resetSession(): string {
  try {
    window.localStorage.removeItem('clinic-bot-session');
  } catch {
    // Nothing to clear if storage was never available.
  }
  memorySessionId = crypto.randomUUID();
  try {
    window.localStorage.setItem('clinic-bot-session', memorySessionId);
  } catch {
    // In-memory id still works for the rest of this page view.
  }
  return memorySessionId;
}

/**
 * Sends a question and streams the reply.
 *
 * Parses SSE by hand rather than using EventSource, which only supports GET and cannot send a
 * request body. Returns once the stream closes.
 */
export async function sendMessage(
  question: string,
  sessionId: string,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sessionId }),
      signal,
    });
  } catch (cause) {
    if ((cause as Error)?.name === 'AbortError') return;
    handlers.onError('Could not reach the practice. Please check your connection and try again.');
    return;
  }

  // Guardrail rejections and validation errors come back as JSON, not a stream.
  if (!response.ok || !response.body) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    handlers.onError(message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (frame: string) => {
    const lines = frame.split('\n');
    const eventLine = lines.find((l) => l.startsWith('event: '));
    const dataLine = lines.find((l) => l.startsWith('data: '));
    if (!eventLine || !dataLine) return;

    const event = eventLine.slice(7).trim();
    let payload: unknown;
    try {
      payload = JSON.parse(dataLine.slice(6));
    } catch {
      return;
    }

    if (event === 'text') {
      handlers.onText((payload as { text: string }).text);
    } else if (event === 'done') {
      handlers.onDone(payload as ChatDone);
    } else if (event === 'error') {
      handlers.onError((payload as { error: string }).error);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush whatever is left. The final frame — always `done`, carrying the citations and
        // the handoff flag — has no blank line after it to trigger a split, so it sits in the
        // buffer when the stream closes. Dropping it silently produced a correct-looking reply
        // with no sources and no lead form, which is the whole point of the feature.
        buffer += decoder.decode();
        if (buffer.trim()) handleFrame(buffer.trim());
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. A partial frame stays in the buffer.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) handleFrame(frame);
    }
  } catch (cause) {
    if ((cause as Error)?.name !== 'AbortError') {
      handlers.onError('The connection dropped mid-reply. Please try again.');
    }
  }
}

export async function submitLead(
  conversationId: string,
  lead: { name: string; contact: string; reason: string },
): Promise<boolean> {
  try {
    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, ...lead }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
