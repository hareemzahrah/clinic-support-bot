'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSessionId,
  resetSession,
  sendMessage,
  type Citation,
} from '@/lib/chat-client';
import { LeadForm } from './LeadForm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  offerHandoff?: boolean;
  isError?: boolean;
}

const SUGGESTIONS = [
  'How much is a check-up?',
  'Are you taking NHS patients?',
  'What are your opening hours?',
  'I have toothache — can I be seen today?',
];

const PRACTICE_NAME = 'Ashfield Dental Practice';
const PRACTICE_PHONE = '01632 960148';

/** Rendered inside the panel and on the launcher, so it lives in one place. */
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

  // Follow the reply as it streams, but only from the bottom — yanking the view back down while
  // someone is scrolled up reading an earlier answer is worse than not following at all.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '' },
      ]);
      setInput('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const update = (patch: Partial<Message>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
        );

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
            update({ citations: done.citations, offerHandoff: done.offerHandoff });
          },
          onError: (message) => update({ content: message, isError: true }),
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
          ? 'flex h-full w-full flex-col bg-white'
          : 'flex h-[min(640px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'
      }
    >
      <header className="flex items-center gap-3 border-b border-slate-200 bg-teal-700 px-4 py-3 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ChatIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{PRACTICE_NAME}</p>
          <p className="truncate text-xs text-teal-100">Usually answers instantly</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={startOver}
            className="rounded-lg px-2 py-1 text-xs text-teal-100 transition hover:bg-white/10 hover:text-white"
          >
            New chat
          </button>
        )}
        {!embedded && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            className="rounded-lg p-1.5 transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-800">
              Hello — I can answer questions about our treatments, fees, opening hours and
              appointments. What would you like to know?
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"
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
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2.5 text-sm text-white">
                  {message.content}
                </div>
              </div>
            );
          }

          const isPending = message.content === '' && isStreaming;

          return (
            <div key={message.id} className="space-y-2">
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tl-sm px-4 py-3 text-sm ${
                  message.isError
                    ? 'bg-red-50 text-red-900'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {isPending ? (
                  <span className="flex gap-1" aria-label="Typing">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                ) : (
                  message.content
                )}
              </div>

              {message.citations && message.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {message.citations.map((citation, i) => (
                    <span
                      key={`${citation.heading}-${i}`}
                      title={citation.heading}
                      className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200"
                    >
                      {citation.title}
                    </span>
                  ))}
                </div>
              )}

              {message.offerHandoff &&
                conversationId &&
                !dismissedHandoffFor.includes(message.id) && (
                  <LeadForm
                    conversationId={conversationId}
                    reason={
                      messages[messages.findIndex((m) => m.id === message.id) - 1]?.content ?? ''
                    }
                    onDismiss={() =>
                      setDismissedHandoffFor((prev) => [...prev, message.id])
                    }
                  />
                )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line. Standard for chat, and people expect
              // it — a textarea that only submits on button click feels broken here.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Ask about fees, hours, treatments…"
            disabled={isStreaming}
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="m22 2-7 20-4-9-9-4 20-7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Demo practice — {PRACTICE_NAME} is fictional. Urgent? Ring {PRACTICE_PHONE}.
        </p>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen && panel}
      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition hover:scale-105 hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <ChatIcon className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
