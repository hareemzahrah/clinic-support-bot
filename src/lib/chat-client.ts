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
 * Session identity, persisted so closing the widget does not throw away the conversation.
 *
 * Closing and reopening keeps the history, which is what Intercom, Crisp and Chatbase all do
 * and what people expect — losing a conversation because you clicked the X while going back to
 * read the page is infuriating. The "New chat" button is there for deliberately starting over.
 *
 * It does expire, though. A session kept forever means someone returning weeks later reopens a
 * stale conversation they have forgotten having, and on a shared computer it leaves one
 * person's dental questions sitting there for the next. A day is long enough to survive a
 * closed tab and short enough not to be a surprise.
 *
 * Every access is wrapped: localStorage throws outright in a private window with site data
 * blocked, and in an iframe whose storage is partitioned — which is exactly how the widget is
 * embedded. Falling back to an in-memory id keeps the chat working; the visitor just starts
 * fresh each page view.
 */

const SESSION_KEY = 'clinic-bot-session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession {
  id: string;
  lastActiveAt: number;
}

let memorySession: StoredSession | null = null;

function readStored(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed?.id !== 'string' || typeof parsed?.lastActiveAt !== 'number') return null;
    return { id: parsed.id, lastActiveAt: parsed.lastActiveAt };
  } catch {
    // Unreadable, unparseable, or an id written by an earlier version. Start fresh rather than
    // trying to migrate — the cost of a lost demo conversation is nil.
    return null;
  }
}

function writeStored(session: StoredSession) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable; the in-memory copy carries this page view.
  }
}

/** The current session id, rotating it if the last one has gone stale. */
export function getSessionId(): string {
  const stored = readStored() ?? memorySession;
  const now = Date.now();

  if (stored && now - stored.lastActiveAt < SESSION_TTL_MS) {
    // Touch it, so an active conversation never expires mid-use.
    const touched = { id: stored.id, lastActiveAt: now };
    memorySession = touched;
    writeStored(touched);
    return stored.id;
  }

  const created = { id: crypto.randomUUID(), lastActiveAt: now };
  memorySession = created;
  writeStored(created);
  return created.id;
}

/** True if the stored session has aged out, so the widget can clear the transcript it is showing. */
export function isSessionExpired(): boolean {
  const stored = readStored() ?? memorySession;
  return !stored || Date.now() - stored.lastActiveAt >= SESSION_TTL_MS;
}

export function resetSession(): string {
  const created = { id: crypto.randomUUID(), lastActiveAt: Date.now() };
  memorySession = created;
  writeStored(created);
  return created.id;
}

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

export interface LeadSubmission {
  name: string;
  contact: string;
  reason: string;
  /** Free text as typed — "next Tuesday", "weekday mornings". Optional. */
  preferredDay?: string;
  preferredTime?: string;
  isUrgent?: boolean;
}

export async function submitLead(
  conversationId: string,
  lead: LeadSubmission,
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
