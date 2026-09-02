/**
 * Run the test sets end to end: retrieve, then answer.
 *
 *   npm run test:adversarial    the 15 gap questions — all must refuse (the release gate)
 *   npm run test:answers        all 65 — the full regression
 *   npm run test:answers -- --show   print every reply, not just failures
 *
 * The adversarial set is the cheap loop to iterate on while tuning the prompt. Run the full
 * set less often, to confirm a fix for one has not broken the other — they pull in opposite
 * directions.
 */

import './load-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retrieve } from '../src/lib/retrieve';
import { answer, type AnswerUsage } from '../src/lib/answer';
import { titleFromFilename } from '../src/lib/ingest/extract';

const SETS = join(process.cwd(), 'test-sets');
const HEADING = /^##\s+.*`(0\d[^`]*\.md)`/;
const NUMBERED_ROW = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|/;

interface TestCase {
  n: number;
  question: string;
  /** Undefined for adversarial cases, which have no correct source. */
  wantedTitle?: string;
  shouldAnswer: boolean;
}

function parseRetrievalSet(): TestCase[] {
  const cases: TestCase[] = [];
  let doc: string | null = null;
  for (const line of readFileSync(join(SETS, 'retrieval-set.md'), 'utf8').split('\n')) {
    const h = line.match(HEADING);
    if (h) {
      doc = h[1];
      continue;
    }
    if (line.startsWith('## ')) {
      doc = null;
      continue;
    }
    if (!doc) continue;
    const r = line.match(NUMBERED_ROW);
    if (r) {
      cases.push({
        n: Number(r[1]),
        question: r[2],
        wantedTitle: titleFromFilename(doc),
        shouldAnswer: true,
      });
    }
  }
  return cases;
}

function parseAdversarialSet(): TestCase[] {
  const cases: TestCase[] = [];
  for (const line of readFileSync(join(SETS, 'adversarial-set.md'), 'utf8').split('\n')) {
    const r = line.match(NUMBERED_ROW);
    if (r) cases.push({ n: Number(r[1]), question: r[2], shouldAnswer: false });
  }
  return cases;
}

interface Outcome {
  test: TestCase;
  pass: boolean;
  answered: boolean;
  text: string;
  raw: string;
  chunkCount: number;
  topSimilarity: number;
  usage: AnswerUsage;
}

async function run(cases: TestCase[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];

  for (const test of cases) {
    const chunks = await retrieve(test.question);
    const result = await answer(test.question, chunks);

    outcomes.push({
      test,
      pass: result.answered === test.shouldAnswer,
      answered: result.answered,
      text: result.text,
      raw: result.raw,
      chunkCount: chunks.length,
      topSimilarity: chunks[0]?.similarity ?? 0,
      usage: result.usage,
    });

    process.stdout.write(result.answered === test.shouldAnswer ? '.' : 'F');
  }

  process.stdout.write('\n');
  return outcomes;
}

function report(outcomes: Outcome[], label: string, showAll: boolean) {
  const failures = outcomes.filter((o) => !o.pass);
  const passed = outcomes.length - failures.length;

  const total = outcomes.reduce(
    (acc, o) => ({
      input: acc.input + o.usage.inputTokens,
      output: acc.output + o.usage.outputTokens,
      cacheRead: acc.cacheRead + o.usage.cacheReadTokens,
      cacheWrite: acc.cacheWrite + o.usage.cacheWriteTokens,
      cost: acc.cost + o.usage.costUsd,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  );

  console.log('');
  console.log(`${label}: ${passed}/${outcomes.length} passed`);

  if (showAll) {
    console.log('');
    for (const o of outcomes) {
      console.log(`  ${o.pass ? 'ok  ' : 'FAIL'} ${String(o.test.n).padStart(2)}. ${o.test.question}`);
      console.log(`       -> ${o.answered ? 'ANSWERED' : 'NO_ANSWER'}  ${o.text.replace(/\n/g, ' ').slice(0, 150)}`);
    }
  } else if (failures.length) {
    console.log('');
    for (const o of failures) {
      const expected = o.test.shouldAnswer ? 'should have ANSWERED' : 'should have REFUSED';
      console.log(`  FAIL ${String(o.test.n).padStart(2)}. ${o.test.question}`);
      console.log(`       ${expected}, said ${o.answered ? 'ANSWERED' : 'NO_ANSWER'}`);
      console.log(`       top similarity ${o.topSimilarity.toFixed(3)}, ${o.chunkCount} chunks`);
      console.log(`       raw: ${JSON.stringify(o.raw.slice(0, 260))}`);
      console.log('');
    }
  }

  const perMessage = total.cost / outcomes.length;
  console.log('');
  console.log(`  tokens   ${total.input} in, ${total.output} out`);
  console.log(`           ${total.cacheWrite} cache write, ${total.cacheRead} cache read`);
  console.log(`  cost     $${total.cost.toFixed(4)} total, $${perMessage.toFixed(5)} per message`);

  if (total.cacheRead === 0 && outcomes.length > 1) {
    console.log('  note     no cache reads — the system prompt is not caching');
  }

  return failures.length;
}

async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--show');
  const adversarialOnly = args.includes('--adversarial');

  if (adversarialOnly) {
    const failed = report(await run(parseAdversarialSet()), 'Adversarial (must all refuse)', showAll);
    if (failed) {
      console.log('\n  The gate is 15/15. Every failure above is a fabricated answer.');
      process.exit(1);
    }
    console.log('\n  Gate passed.');
    return;
  }

  const adversarial = await run(parseAdversarialSet());
  const retrieval = await run(parseRetrievalSet());

  const failedAdv = report(adversarial, 'Adversarial (must all refuse)', showAll);
  const failedRet = report(retrieval, 'Retrieval (must all answer)', showAll);

  if (failedAdv || failedRet) process.exit(1);
}

main().catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
