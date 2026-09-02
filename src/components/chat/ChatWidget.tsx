'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionId, resetSession, sendMessage, type Citation } from '@/lib/chat-client';
import { LeadForm } from './LeadForm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  offerHandoff?: boolean;
  isError?: boolean;
  done?: boolean;
}

const SUGGESTIONS = [
  'How much is a check-up?',
  'Are you taking NHS patients?',
  'What are your opening hours?',
  'What happens if I miss my appointment?',
];

const PRACTICE_NAME = 'Ashfield Dental';
const PRACTICE_PHONE = '01632 960148';

function Logo({ className = 'h-5 w-5' }: { className?: string }) {
  // A tooth, drawn simply enough to stay legible at 20px.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 3.2c-1.6 0-2.3.7-3.7.7-1.6 0-3.6.4-3.6 3.6 0 2.8.9 4.2 1.4 6.4.4 1.7.3 4.4.8 5.6.4.9 1.6 1 2-.1.5-1.4.5-3.4 1.1-4.6.4-.8 1.6-.8 2 0 .6 1.2.6 3.2 1.1 4.6.4 1.1 1.6 1 2 .1.5-1.2.4-3.9.8-5.6.5-2.2 1.4-3.6 1.4-6.4 0-3.2-2-3.6-3.6-3.6-1.4 0-2.1-.7-3.7-.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Small numbered chips after a reply, the way Fin marks its references.
 *
 * Numbers rather than document names because the names are long — "Appointments and Practice
 * Policies" swamps a two-sentence answer. The name lives in the tooltip and in the expanded
 * list, which is where someone who actually cares will look.
 */
function Sources({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-1.5 text-[12px] text-on-surface-variant/60 transition hover:text-on-surface-variant"
      >
        <span className="flex gap-1">
          {citations.map((citation, i) => (
            <span
              key={`${citation.heading}-${i}`}
              title={citation.heading}
              className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-surface-highest px-1 text-[11px] font-medium text-on-surface-variant"
            >
              {i + 1}
            </span>
          ))}
        </span>
        <span>{open ? 'Hide sources' : 'Sources'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-1 border-l border-outline-variant/40 pl-3">
          {citations.map((citation, i) => (
            <li key={`${citation.heading}-detail-${i}`} className="text-[12px] leading-snug">
              <span className="text-on-surface-variant/60">{i + 1}. </span>
              <span className="text-on-surface-variant">{citation.heading}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChatWidget({ embedded = false }: { embedded?: boolean }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dismissedHandoffFor, setDismissedHandoffFor] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Follow the reply as it streams, but only from the bottom — yanking the view down while
  // someone is scrolled up reading an earlier answer is worse than not following at all.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Grow the input with its content, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isStreaming) return;

      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: trimmed },
        { id: assistantId, role: 'assistant', content: '' },
      ]);
      setInput('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const update = (patch: Partial<Message>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));

      await sendMessage(
        trimmed,
        getSessionId(),
        {
          onText: (delta) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m,
              ),
            ),
          onDone: (done) => {
            setConversationId(done.conversationId);
            update({ citations: done.citations, offerHandoff: done.offerHandoff, done: true });
          },
          onError: (message) => update({ content: message, isError: true, done: true }),
        },
        controller.signal,
      );

      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    },
    [isStreaming],
  );

  function startOver() {
    abortRef.current?.abort();
    resetSession();
    setMessages([]);
    setConversationId(null);
    setDismissedHandoffFor([]);
    setIsStreaming(false);
  }

  const panel = (
    <div
      className={
        embedded
          ? 'flex h-full w-full flex-col bg-surface-mid'
          : 'animate-rise flex h-[min(680px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-mid shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)]'
      }
    >
      <header className="flex items-center gap-3 border-b border-outline-variant/30 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
          <Logo />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-on-surface">{PRACTICE_NAME}</p>
          <p className="truncate text-[12px] text-on-surface-variant/60">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
            Answers instantly
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={startOver}
            title="Start a new conversation"
            className="rounded-lg px-2 py-1 text-[12px] text-on-surface-variant/60 transition hover:bg-surface-high hover:text-on-surface"
          >
            New chat
          </button>
        )}
        {!embedded && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            className="rounded-lg p-1.5 text-on-surface-variant/60 transition hover:bg-surface-high hover:text-on-surface"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div ref={scrollRef} className="thin-scroll flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="space-y-5">
            <div className="flex gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
                <Logo className="h-4 w-4" />
              </div>
              {/* No name in the greeting. Fin can say "Hey Hareem" because it knows who is
                  logged in; a clinic's website visitor is anonymous, and inventing a name or
                  leaving a "Hey there," placeholder both read worse than not trying. */}
              <div className="rounded-2xl rounded-tl-md bg-surface-high px-4 py-3 text-[14px] leading-relaxed text-on-surface">
                <span aria-hidden="true">👋</span> Hi — you&rsquo;re chatting with Ashfield
                Dental&rsquo;s assistant. Ask about treatments, fees, opening hours or
                appointments and I&rsquo;ll answer from the practice&rsquo;s own information.
              </div>
            </div>

            <div className="space-y-1.5 pl-9">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  className="block w-full rounded-xl border border-outline-variant/40 bg-surface-high/40 px-3.5 py-2.5 text-left text-[13px] text-on-surface-variant transition hover:border-cta/50 hover:bg-surface-high hover:text-on-surface"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-cta px-4 py-2.5 text-[14px] leading-relaxed text-white">
                  {message.content}
                </div>
              </div>
            );
          }

          const isPending = message.content === '' && isStreaming;

          return (
            <div key={message.id} className="flex gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
                <Logo className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`inline-block max-w-full rounded-2xl rounded-tl-md px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
                    message.isError
                      ? 'bg-danger-container/40 text-danger'
                      : 'bg-raised text-fg'
                  }`}
                >
                  {isPending ? (
                    <span className="flex items-center gap-1 py-0.5" aria-label="Typing">
                      {[0, 160, 320].map((delay) => (
                        <span
                          key={delay}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-faint"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  ) : (
                    message.content
                  )}
                </div>

                {message.citations && message.citations.length > 0 && (
                  <Sources citations={message.citations} />
                )}

                {message.done && !message.isError && (
                  <p className="mt-1.5 text-[11px] text-on-surface-variant/60">
                    {PRACTICE_NAME} · AI assistant
                  </p>
                )}

                {message.offerHandoff &&
                  conversationId &&
                  !dismissedHandoffFor.includes(message.id) && (
                    <div className="mt-3">
                      <LeadForm
                        conversationId={conversationId}
                        reason={
                          messages[messages.findIndex((m) => m.id === message.id) - 1]?.content ?? ''
                        }
                        onDismiss={() => setDismissedHandoffFor((prev) => [...prev, message.id])}
                      />
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-outline-variant/30 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-outline-variant/40 bg-surface-high px-3 py-2 transition focus-within:border-cta/50"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line — what people expect from a chat box.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Message…"
            disabled={isStreaming}
            className="max-h-[120px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-relaxed text-fg placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cta text-white transition hover:bg-cta-hover disabled:bg-surface-highest disabled:text-on-surface-variant/60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] text-on-surface-variant/60">
          Demo — {PRACTICE_NAME} is fictional. Urgent? Ring {PRACTICE_PHONE}.
        </p>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3">
      {isOpen && panel}
      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-cta text-white shadow-[0_8px_30px_rgba(139,92,246,0.45)] transition hover:scale-105 hover:bg-cta-hover focus:ring-4 focus:ring-cta/30 focus:outline-none"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        ) : (
          <Logo className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
