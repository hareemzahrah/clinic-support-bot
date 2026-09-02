/**
 * Find the similarity threshold that best separates answerable questions from gaps.
 *
 *   npm run tune
 *
 * The two test sets pull in opposite directions. Raising the threshold makes the bot refuse
 * more, which helps the adversarial set and hurts the retrieval set; lowering it does the
 * reverse. Tuning against one alone quietly wrecks the other, so this measures both at once.
 *
 * The number that matters is the SEPARATION: the gap between the weakest genuine hit and the
 * strongest false hit. If that gap is positive, a threshold can do the work on its own. If it
 * is negative the sets overlap, no threshold separates them, and the grounding prompt has to
 * carry the refusals instead. Either answer is useful — it says where to spend effort.
 */

import './load-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retrieve, DEFAULT_TOP_K } from '../src/lib/retrieve';
import { corpusTitle } from './corpus-title';

const SETS = join(process.cwd(), 'test-sets');
const THRESHOLDS = [0.2, 0.25, 0.3, 0.32, 0.35, 0.4, 0.45];

const HEADING = /^##\s+.*`(0\d[^`]*\.md)`/;
const NUMBERED_ROW = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|/;

function parseRetrievalSet() {
  const cases: Array<{ n: number; question: string; wantedTitle: string }> = [];
  let doc: string | null = null;
  for (const line of readFileSync(join(SETS, 'retrieval-set.md'), 'utf8').split('\n')) {
    const h = line.match(HEADING);
    if (h) { doc = h[1]; continue; }
    if (line.startsWith('## ')) { doc = null; continue; }
    if (!doc) continue;
    const r = line.match(NUMBERED_ROW);
    if (r) cases.push({ n: Number(r[1]), question: r[2], wantedTitle: corpusTitle(doc) });
  }
  return cases;
}

function parseAdversarialSet() {
  const cases: Array<{ n: number; question: string }> = [];
  for (const line of readFileSync(join(SETS, 'adversarial-set.md'), 'utf8').split('\n')) {
    const r = line.match(NUMBERED_ROW);
    if (r) cases.push({ n: Number(r[1]), question: r[2] });
  }
  return cases;
}

/**
 * Retrieve once per question at threshold 0, then evaluate every candidate threshold against
 * the same results. Re-querying per threshold would embed each question seven times for no
 * additional information.
 */
async function profile() {
  const genuine = parseRetrievalSet();
  const gaps = parseAdversarialSet();

  const genuineHits: Array<{ n: number; question: string; sim: number | null }> = [];
  for (const c of genuine) {
    const chunks = await retrieve(c.question, { threshold: 0, topK: DEFAULT_TOP_K });
    const hit = chunks.find((ch) => ch.documentTitle === c.wantedTitle);
    genuineHits.push({ n: c.n, question: c.question, sim: hit?.similarity ?? null });
  }

  const gapTops: Array<{ n: number; question: string; sim: number }> = [];
  for (const c of gaps) {
    const chunks = await retrieve(c.question, { threshold: 0, topK: DEFAULT_TOP_K });
    gapTops.push({ n: c.n, question: c.question, sim: chunks[0]?.similarity ?? 0 });
  }

  return { genuineHits, gapTops };
}

function main() {
  return profile().then(({ genuineHits, gapTops }) => {
    console.log('\n  thresh   retrieval        adversarial leak');
    console.log('  ------   --------------   ----------------');

    for (const t of THRESHOLDS) {
      const found = genuineHits.filter((g) => g.sim !== null && g.sim >= t).length;
      const leaked = gapTops.filter((g) => g.sim >= t).length;
      console.log(
        `  ${t.toFixed(2)}     ${String(found).padStart(2)}/50 (${String(
          Math.round((found / 50) * 100),
        ).padStart(3)}%)     ${String(leaked).padStart(2)}/15 retrieve something`,
      );
    }

    const weakestGenuine = Math.min(...genuineHits.filter((g) => g.sim !== null).map((g) => g.sim!));
    const strongestGap = Math.max(...gapTops.map((g) => g.sim));

    console.log('');
    console.log(`  weakest genuine hit:  ${weakestGenuine.toFixed(3)}`);
    console.log(`  strongest gap match:  ${strongestGap.toFixed(3)}`);
    console.log(`  separation:           ${(weakestGenuine - strongestGap).toFixed(3)}`);
    console.log('');

    if (weakestGenuine > strongestGap) {
      console.log('  The sets separate cleanly. A threshold between them refuses every gap');
      console.log('  question without dropping a genuine one.');
    } else {
      console.log('  The sets OVERLAP. No threshold separates them: any value that catches all');
      console.log('  50 genuine questions also lets gap questions retrieve content. The');
      console.log('  grounding prompt has to carry those refusals, not the threshold.');
      console.log('');
      console.log('  Set the threshold low enough for full retrieval, and spend the effort on');
      console.log('  the prompt. Verify with the adversarial set in Phase 2b.');
    }

    console.log('\n  Gap questions scoring highest (these are the prompt\'s hardest cases):');
    for (const g of [...gapTops].sort((a, b) => b.sim - a.sim).slice(0, 5)) {
      console.log(`    ${g.sim.toFixed(3)}  ${String(g.n).padStart(2)}. ${g.question.slice(0, 62)}`);
    }
  });
}

main().catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
