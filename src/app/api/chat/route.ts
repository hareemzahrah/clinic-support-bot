/**
 * POST /api/chat — the widget's only endpoint.
 *
 * Streams a grounded answer as Server-Sent Events. Deliberately hand-rolled rather than using a
 * streaming SDK: the marker and SOURCES line have to be stripped mid-stream, and owning the
 * protocol is simpler than adapting one. The whole wire format is three event types.
 *
 * This endpoint is public and unauthenticated by design — the widget embeds on any site. Every
 * request therefore passes the guardrails first, before anything billable happens.
 */

import { NextResponse } from 'next/server';
import { answerStream } from '@/lib/answer';
import { checkGuardrails, clientIp } from '@/lib/guardrails';
import { retrieve } from '@/lib/retrieve';
import { getSupabase } from '@/lib/supabase';

// node:crypto in the guardrails means this cannot run on the edge runtime.
export const runtime = 'nodejs';

const MAX_QUESTION_LENGTH = 500;
const HISTORY_TURNS = 6;

interface ChatRequest {
  question?: unknown;
  sessionId?: unknown;
}

interface Citation {
  title: string;
  heading: string;
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Finds or creates the conversation for a session, and returns the recent turns so the model
 * has context for follow-ups ("how much is that?" after asking about crowns).
 */
async function loadConversation(sessionId: string) {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  let conversationId = existing?.id as string | undefined;

  if (!conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ session_id: sessionId })
      .select('id')
      .single();
    if (error) throw new Error(`Could not start conversation: ${error.message}`);
    conversationId = data.id as string;
  }

  const { data: rows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);

  const history = (rows ?? [])
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string }));

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('role', 'user');

  return { conversationId, history, userMessageCount: count ?? 0 };
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

  if (!question) {
    return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Questions are limited to ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!sessionId || sessionId.length > 100) {
    return NextResponse.json({ error: 'A valid sessionId is required.' }, { status: 400 });
  }

  let conversationId: string;
  let history: Array<{ role: 'user' | 'assistant'; content: string }>;
  let userMessageCount: number;

  try {
    ({ conversationId, history, userMessageCount } = await loadConversation(sessionId));
  } catch (cause) {
    console.error('[chat] conversation load failed', cause);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  // Guardrails run before retrieval and before the model, so a blocked request costs nothing.
  let verdict;
  try {
    verdict = await checkGuardrails(clientIp(request.headers), userMessageCount);
  } catch (cause) {
    console.error('[chat] guardrail check failed', cause);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  if (!verdict.allowed) {
    return NextResponse.json(
      { error: verdict.message, reason: verdict.reason },
      { status: 429 },
    );
  }

  const supabase = getSupabase();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = await retrieve(question);

        await supabase
          .from('messages')
          .insert({ conversation_id: conversationId, role: 'user', content: question });

        let fullText = '';

        for await (const part of answerStream(question, chunks, history)) {
          if (part.type === 'text') {
            fullText += part.text;
            controller.enqueue(sse('text', { text: part.text }));
            continue;
          }

          const { result } = part;

          const citations: Citation[] = result.citedChunkIds
            .map((id) => chunks.find((c) => c.id === id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .map((c) => ({ title: c.documentTitle, heading: c.headingPath }));

          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: result.text,
            cited_chunk_ids: result.citedChunkIds,
            was_answered: result.answered,
          });

          await supabase
            .from('conversations')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', conversationId);

          controller.enqueue(
            sse('done', {
              answered: result.answered,
              citations,
              conversationId,
              // Surfaced so the widget can offer lead capture when the practice's documents
              // could not answer — the moment a visitor is most worth capturing.
              offerHandoff: !result.answered,
            }),
          );
        }

        // A model that returns nothing at all should not look like a successful empty reply.
        if (!fullText.trim()) {
          controller.enqueue(
            sse('error', { error: 'No reply was generated. Please try again.' }),
          );
        }
      } catch (cause) {
        console.error('[chat] stream failed', cause);
        controller.enqueue(
          sse('error', {
            error:
              "Sorry — something went wrong at our end. Please try again, or ring the practice on 01632 960148.",
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx and some proxies buffer streamed responses without this, which would deliver the
      // whole reply at once and lose the point of streaming.
      'X-Accel-Buffering': 'no',
    },
  });
}
