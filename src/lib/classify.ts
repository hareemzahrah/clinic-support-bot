/**
 * Second-pass classification of whether a reply actually answered the question.
 *
 * Why this exists: the answering model was originally asked to self-assess with a leading
 * ANSWERED / NO_ANSWER marker. Its *replies* were correct every time — no fabrication in any
 * test run — but the marker was not reliably right. It would decline to answer, offer genuinely
 * useful related information, and then mark the turn ANSWERED because the reply felt helpful.
 * Roughly one turn in five on the borderline cases, which is not good enough for a flag the
 * practice reads as "our documents failed here".
 *
 * Two jobs were being asked of one call: answer well, and grade yourself. Splitting them fixed
 * it. A small model given only the question and the reply, with nothing to defend, is a far
 * better judge than the model that just wrote the reply.
 *
 * Cheap and off the critical path: Haiku, a few hundred tokens, run after the reply has already
 * streamed to the visitor. Nobody waits for it.
 */

import Anthropic from '@anthropic-ai/sdk';
import { withRetry } from './retry';

/** Haiku is more than capable of a binary judgement and costs a fifth of the answering model. */
export const CLASSIFIER_MODEL = 'claude-haiku-4-5';

const SYSTEM = `You judge one thing: did the practice's own information contain what this person asked for?

YES — the reply states the fact they asked about.
NO — the reply says the practice does not hold that information, or gives related information instead of the thing asked for.

Two traps, and almost every mistake is one of them.

**Trap one: reading a negative answer as a non-answer.** "No, we don't offer that" IS an answer. So is "no, not online", "no, that's private only", "you can't be seen if you're more than ten minutes late". A definite no is information. Judge YES.

**Trap two: reading a next step as a non-answer.** Being told to telephone to book an appointment, to ring the same day, or to bring something with them is an answer to "what should I do?". Judge YES. Only judge NO when the person must ring in order to *find out the fact they asked for* — that is, when the practice's information simply does not contain it.

Ignore tone, warmth and how helpful the reply sounds. A reply can be very helpful and still be NO, and it can be blunt and still be YES.

Worked examples:

Q: "Do you do implants?" — A: "No, we don't place implants here. We refer to a specialist and handle the follow-up care."
YES. A definite no.

Q: "Can I book a filling online?" — A: "No, online booking is examinations and hygiene only. Treatment is booked by phone."
YES. A definite no, plus what to do instead.

Q: "My filling feels too high when I bite." — A: "Telephone us and we'll adjust it. Don't wait — an unbalanced bite can crack the tooth."
YES. They asked what to do and were told.

Q: "I'm going to be 15 minutes late, can I still be seen?" — A: "If you arrive more than 10 minutes late we may not be able to see you; it would be treated as a late cancellation."
YES. The policy answers it.

Q: "How much is a check-up?" — A: "£54 routine, £79 for a new patient, £27.90 on the NHS."
YES.

Q: "Which dental school did my dentist train at?" — A: "We don't list where our dentists trained. All our dentists are GDC registered."
NO. The practice does not hold it. They still do not know the school.

Q: "How long is the wait for your NHS list?" — A: "We're not taking new adult NHS patients. We keep an expression-of-interest list and contact people when capacity comes up."
NO. They asked how long and still do not know.

Q: "Do you offer sedation?" — A: "We don't have anything confirming whether sedation is available. For anxious patients we allow longer appointments."
NO. Related information, not the answer.

Greetings, thanks and small talk are YES — they are not questions that went unanswered.

Reply with exactly one word: YES or NO.`;

/**
 * Returns whether the reply answered the question, or `null` if the judgement could not be made.
 *
 * A null verdict means the caller should fall back to the answering model's own marker rather
 * than guess — a classifier outage should degrade the dashboard's accuracy, not the reply.
 */
export async function classifyAnswered(
  question: string,
  reply: string,
): Promise<boolean | null> {
  try {
    const client = new Anthropic();

    const response = await withRetry(() =>
      client.messages.create({
        model: CLASSIFIER_MODEL,
        max_tokens: 5,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Question: ${question}\n\nReply: ${reply}`,
          },
        ],
      }),
    );

    const verdict = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .toUpperCase();

    if (verdict.startsWith('YES')) return true;
    if (verdict.startsWith('NO')) return false;
    return null;
  } catch {
    return null;
  }
}
