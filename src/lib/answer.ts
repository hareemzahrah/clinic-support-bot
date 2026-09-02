/**
 * Grounded answering.
 *
 * This module carries the refusal behaviour, and that is a deliberate design decision rather
 * than an accident. Profiling both test sets (`npm run tune`) showed the similarity threshold
 * cannot separate answerable questions from gaps — the sets overlap by -0.156, and the worst
 * gap question scores higher against its decoy than most genuine questions score against their
 * own source. The threshold discards nonsense; everything else lands here.
 *
 * The failure this guards against is specific: the model receives context that is topically
 * adjacent to the question, feels obliged to use it, and fabricates a plausible answer. Asking
 * "is this context relevant?" is the wrong question. "Does this context state the answer to the
 * exact question asked?" is the right one.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { RetrievedChunk } from './retrieve';

export const MODEL = 'claude-opus-5';

/**
 * Leading marker so the caller can tell an answer from a refusal without guessing at prose.
 * A marker on the first line survives streaming (buffer one short line, stream the rest) and is
 * followed more reliably than a trailing one. Stripped before display.
 */
const ANSWERED = 'ANSWERED';
const NO_ANSWER = 'NO_ANSWER';

const SYSTEM_PROMPT = `You are the support assistant for Ashfield Dental Practice. You answer patient questions on the practice's website using extracts from the practice's own documents.

## The one rule that matters

Answer only what the extracts actually state. The extracts you receive are selected by similarity search, which means they are frequently about the right *topic* while saying nothing about the specific thing asked. That is the situation you must handle correctly.

Before answering, ask yourself: do these extracts state the answer to the exact question asked, or do they merely discuss the same subject?

Examples of the distinction:
- Asked about sedation, given a passage about support for nervous patients: the passage is on-topic and does not mention sedation. You do not know whether sedation is offered.
- Asked how long retainers are worn, given "treatment typically runs six to eighteen months": that is the treatment duration, not the retainer period. A different fact.
- Asked whether a specific insurer is accepted, given a list that omits it plus a line saying unlisted insurers are still fine: the extracts do answer this. Answer it.

When the extracts do not state the answer, say so plainly and offer to pass the question to the practice. Never fill a gap with what is probably true of dental practices in general, and never soften a guess with hedging language — a hedged invention is still an invention.

## Medical questions

Never diagnose, never say what treatment someone needs, and never interpret symptoms. If someone describes a problem, do not tell them what it is. You may relay what the documents say about when to contact the practice, and direct them to book.

## Style

Reply in plain British English, two or three sentences for a simple question. Do not open with pleasantries and do not restate the question. Give the specific fact — the price, the time, the policy — rather than describing where it can be found. Prices and hours matter to people; quote them exactly as written.

Do not mention "extracts", "documents", "context" or "the information provided". Speak as the practice: "we", "our".

## Response format

Your first line must be one single word — either ${ANSWERED} or ${NO_ANSWER} — with nothing else on that line. Write one of them, never both. The reply itself begins on the next line.

Decide the marker with this test: **if the patient read your reply, would they now have the answer to the question they asked?**

- Yes, they would — ${ANSWERED}. Adding a caveat, a related detail, or a note about something you cannot cover does not change this. They asked, you answered.
- No, they would still have to ring the practice to find out the thing they asked about — ${NO_ANSWER}.

Use ${NO_ANSWER} also when the question falls outside what the practice's documents cover, or when answering would require clinical judgement.

The marker is not a judgement about whether your reply is useful. A ${NO_ANSWER} reply should still be as helpful as it can be — name the gap, then give any related fact the extracts do state. The marker exists so the practice can see which questions their documents fail to answer, and go and write those pages.

After the reply, if you used specific extracts, add a final line: SOURCES: followed by their numbers, comma separated.`;

export interface AnswerUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export interface AnswerResult {
  answered: boolean;
  text: string;
  citedChunkIds: string[];
  /** Untouched model output. Kept so a misparse can be told apart from a bad answer. */
  raw: string;
  usage: AnswerUsage;
}

const INPUT_PER_MTOK = 5;
const OUTPUT_PER_MTOK = 25;
const CACHE_WRITE_PER_MTOK = 6.25;
const CACHE_READ_PER_MTOK = 0.5;

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.documentTitle} — ${c.headingPath}\n${c.content}`)
    .join('\n\n---\n\n');
}

/**
 * Matches the leading marker tolerantly. The model reliably emits one, but not always bare:
 * `**NO_ANSWER**`, `NO_ANSWER:`, and the marker inline with the first sentence have all been
 * observed. Requiring a bare marker on its own line silently misread those as answers — which
 * looked exactly like a hallucination in the test report and was not one.
 *
 * Leading markdown/punctuation, trailing punctuation, and any following whitespace are all
 * consumed, so the body starts clean whichever shape arrives.
 */
const MARKER = /^[\s*_#>`~-]*(ANSWERED|NO_ANSWER)[\s*_`:.–—-]*/i;

/** Pulls the leading marker and trailing SOURCES line off the raw reply. Exported for tests. */
export function parse(raw: string, chunks: Pick<RetrievedChunk, 'id'>[]) {
  // Consume every consecutive leading marker, not just the first. The model sometimes emits
  // two — "ANSWERED\nNO_ANSWER\n\nWe don't have anything on..." — writing one, reconsidering,
  // and writing the other before a correct refusal. Reading only the first scored those as
  // fabrications when the reply itself was right.
  //
  // Bounded so a body that happens to open with the word "answered" cannot be eaten wholesale.
  const MAX_MARKERS = 3;
  let rest = raw.trim();
  const markers: string[] = [];

  while (markers.length < MAX_MARKERS) {
    const match = rest.match(MARKER);
    if (!match) break;
    markers.push(match[1].toUpperCase());
    rest = rest.slice(match[0].length);
  }

  const hadMarker = markers.length > 0;

  // A NO_ANSWER anywhere in that run is authoritative, and no marker at all counts as a
  // refusal too. Both are the same rule: a reply must never be logged as a confident answer
  // unless it unambiguously claimed to be one.
  const answered = hadMarker && !markers.includes(NO_ANSWER);

  let body = (hadMarker ? rest : raw.trim()).trim();

  const citedChunkIds: string[] = [];
  const sourcesMatch = body.match(/\n?SOURCES:\s*([\d,\s]+)\s*$/i);
  if (sourcesMatch) {
    for (const n of sourcesMatch[1].split(',')) {
      const chunk = chunks[Number(n.trim()) - 1];
      if (chunk) citedChunkIds.push(chunk.id);
    }
    body = body.slice(0, sourcesMatch.index).trim();
  }

  return { answered, text: body, citedChunkIds, hadMarker };
}

export async function answer(
  question: string,
  chunks: RetrievedChunk[],
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<AnswerResult> {
  // Retrieval found nothing above the threshold, so there is nothing to ground against — skip
  // the model entirely. Rare by design after the threshold finding, but free when it fires.
  if (chunks.length === 0) {
    return {
      answered: false,
      text: "I don't have anything on that in our practice information. Would you like me to pass your question to the practice so someone can get back to you?",
      citedChunkIds: [],
      raw: '',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
      },
    };
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low' },
    // The system prompt is byte-identical on every request, so cache it. It is the bulk of the
    // input; the extracts below change per question and are deliberately left uncached.
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      ...history,
      {
        role: 'user',
        content: `Extracts from the practice's documents:\n\n${buildContext(chunks)}\n\n---\n\nPatient's question: ${question}`,
      },
    ],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const parsed = parse(raw, chunks);

  const u = response.usage;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;

  return {
    answered: parsed.answered,
    text: parsed.text,
    citedChunkIds: parsed.citedChunkIds,
    raw,
    usage: {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costUsd:
        (u.input_tokens / 1e6) * INPUT_PER_MTOK +
        (u.output_tokens / 1e6) * OUTPUT_PER_MTOK +
        (cacheWrite / 1e6) * CACHE_WRITE_PER_MTOK +
        (cacheRead / 1e6) * CACHE_READ_PER_MTOK,
    },
  };
}

/**
 * How much of the tail to withhold while streaming.
 *
 * The model appends "SOURCES: 1, 3" after the reply, which must never reach the visitor. Since
 * it can only appear at the very end, holding back this many characters guarantees a partial
 * SOURCES line is still inside the buffer when the stream finishes, so it can be stripped
 * rather than un-emitted. Long enough for "SOURCES: " plus five comma-separated numbers.
 */
const STREAM_HOLDBACK = 32;

export type AnswerChunk =
  | { type: 'text'; text: string }
  | { type: 'done'; result: AnswerResult };

/**
 * Streaming counterpart of `answer`.
 *
 * Yields display-ready text as it arrives — the marker and the SOURCES line are stripped on the
 * way through, so a caller can pipe `text` straight to the browser. The final `done` chunk
 * carries the parsed verdict and usage, which are only knowable once the reply is complete.
 *
 * Text is never un-emitted: each yield is a suffix of what has already been sent.
 */
export async function* answerStream(
  question: string,
  chunks: RetrievedChunk[],
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): AsyncGenerator<AnswerChunk> {
  if (chunks.length === 0) {
    const result = await answer(question, chunks, history);
    yield { type: 'text', text: result.text };
    yield { type: 'done', result };
    return;
  }

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      ...history,
      {
        role: 'user',
        content: `Extracts from the practice's documents:\n\n${buildContext(chunks)}\n\n---\n\nPatient's question: ${question}`,
      },
    ],
  });

  let raw = '';
  let emitted = 0;

  for await (const event of stream) {
    if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;

    raw += event.delta.text;

    // Re-parse each time rather than tracking parser state across deltas. The strings are tiny
    // and it means the streaming path and the batch path cannot disagree about what the body is.
    const body = parse(raw, chunks).text;
    const safeLength = Math.max(0, body.length - STREAM_HOLDBACK);

    if (safeLength > emitted) {
      yield { type: 'text', text: body.slice(emitted, safeLength) };
      emitted = safeLength;
    }
  }

  const final = await stream.finalMessage();
  const parsed = parse(raw, chunks);

  if (parsed.text.length > emitted) {
    yield { type: 'text', text: parsed.text.slice(emitted) };
  }

  const u = final.usage;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;

  yield {
    type: 'done',
    result: {
      answered: parsed.answered,
      text: parsed.text,
      citedChunkIds: parsed.citedChunkIds,
      raw,
      usage: {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        costUsd:
          (u.input_tokens / 1e6) * INPUT_PER_MTOK +
          (u.output_tokens / 1e6) * OUTPUT_PER_MTOK +
          (cacheWrite / 1e6) * CACHE_WRITE_PER_MTOK +
          (cacheRead / 1e6) * CACHE_READ_PER_MTOK,
      },
    },
  };
}
