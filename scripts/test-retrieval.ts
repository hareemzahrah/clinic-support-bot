/**
 * Score retrieval against test-sets/retrieval-set.md.
 *
 *   npm run test:retrieval                     score at the default threshold
 *   npm run test:retrieval -- --sweep          try a range of thresholds
 *   npm run test:retrieval -- --threshold 0.4  score at a specific threshold
 *   npm run test:retrieval -- --verbose        show every question, not just misses
 *
 * The test set is parsed from the markdown directly so there is one source of truth. A
 * section heading naming a corpus file sets the expected document for the rows beneath it;
 * the sanity-check section has no filename in its heading and is skipped.
 */

import './load-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retrieve, DEFAULT_THRESHOLD, DEFAULT_TOP_K } from '../src/lib/retrieve';
import { corpusTitle } from './corpus-title';

const SET_PATH = join(process.cwd(), 'test-sets', 'retrieval-set.md');

const HEADING = /^##\s+.*`(0\d[^`]*\.md)`/;
const ROW = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/;

interface Case {
  n: number;
  question: string;
  expectedDoc: string;
  mustContain: string;
}

function parseCases(): Case[] {
  const cases: Case[] = [];
  let currentDoc: string | null = null;

  for (const line of readFileSync(SET_PATH, 'utf8').split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      currentDoc = heading[1];
      continue;
    }
    // A heading without a filename ends the current section (e.g. "Sanity checks").
    if (line.startsWith('## ')) {
      currentDoc = null;
      continue;
    }
    if (!currentDoc) continue;

    const row = line.match(ROW);
    if (row) {
      cases.push({
        n: Number(row[1]),
        question: row[2],
        expectedDoc: currentDoc,
        mustContain: row[3],
      });
    }
  }
  return cases;
}

/**
 * Ingest derives a document title from the filename, stripping the leading number:
 * "01-services-and-treatments.md" becomes "Services And Treatments". Run the expected
 * filename through the same function so the comparison is exact rather than fuzzy.
 */
const expectedTitle = (filename: string) => corpusTitle(filename);

interface Scored extends Case {
  hit: boolean;
  rank: number | null;
  topSimilarity: number | null;
  hitSimilarity: number | null;
  got: string[];
}

async function score(threshold: number, topK: number): Promise<Scored[]> {
  const cases = parseCases();
  const results: Scored[] = [];

  for (const c of cases) {
    const chunks = await retrieve(c.question, { threshold, topK });
    const titles = chunks.map((ch) => ch.documentTitle);
    const wanted = expectedTitle(c.expectedDoc);
    const rank = chunks.findIndex((ch) => ch.documentTitle === wanted);

    results.push({
      ...c,
      hit: rank >= 0,
      rank: rank >= 0 ? rank + 1 : null,
      topSimilarity: chunks[0]?.similarity ?? null,
      hitSimilarity: rank >= 0 ? chunks[rank].similarity : null,
      got: titles,
    });
  }
  return results;
}

function summarise(results: Scored[], threshold: number, topK: number, verbose: boolean) {
  const hits = results.filter((r) => r.hit);
  const misses = results.filter((r) => !r.hit);
  const empty = results.filter((r) => r.got.length === 0);

  console.log('');
  console.log(`threshold ${threshold}  top-k ${topK}`);
  console.log(
    `  ${hits.length}/${results.length} correct document retrieved ` +
      `(${((hits.length / results.length) * 100).toFixed(0)}%)`,
  );
  if (empty.length) console.log(`  ${empty.length} returned nothing at all`);

  const atOne = hits.filter((r) => r.rank === 1).length;
  console.log(`  ${atOne} of those ranked the correct document first`);

  if (hits.length) {
    const sims = hits.map((r) => r.hitSimilarity!).sort((a, b) => a - b);
    console.log(
      `  correct-hit similarity: min ${sims[0].toFixed(3)}  ` +
        `median ${sims[Math.floor(sims.length / 2)].toFixed(3)}  ` +
        `max ${sims[sims.length - 1].toFixed(3)}`,
    );
  }

  if (verbose) {
    console.log('');
    for (const r of results) {
      const mark = r.hit ? 'ok  ' : 'MISS';
      console.log(
        `  ${mark} ${String(r.n).padStart(2)}. ${r.question.slice(0, 52).padEnd(54)}` +
          `${r.hit ? `rank ${r.rank}  ${r.hitSimilarity!.toFixed(3)}` : 'not in top-k'}`,
      );
    }
  } else if (misses.length) {
    console.log('');
    console.log(`  Misses:`);
    for (const r of misses) {
      console.log(`    ${String(r.n).padStart(2)}. ${r.question}`);
      console.log(`        wanted ${r.expectedDoc}`);
      console.log(`        got    ${r.got.length ? r.got.join(', ') : '(nothing above threshold)'}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const topK = Number(args[args.indexOf('--top-k') + 1]) || DEFAULT_TOP_K;

  if (args.includes('--sweep')) {
    for (const threshold of [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]) {
      summarise(await score(threshold, topK), threshold, topK, false);
    }
    console.log('\nPick the lowest threshold that still keeps the adversarial set passing.');
    return;
  }

  const threshold = args.includes('--threshold')
    ? Number(args[args.indexOf('--threshold') + 1])
    : DEFAULT_THRESHOLD;

  summarise(await score(threshold, topK), threshold, topK, verbose);
}

main().catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
