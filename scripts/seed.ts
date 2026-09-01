/**
 * Seed the demo corpus.
 *
 *   npm run seed:dry    inspect chunking only — no API keys needed
 *   npm run seed        chunk, embed and store
 *
 * The glob is pinned to content/0*.md. content/README.md documents the corpus's deliberate
 * gaps; indexing it would let the bot retrieve its own answer key and silently invalidate the
 * adversarial test set. Do not widen this.
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chunkMarkdown } from '../src/lib/ingest/chunk';
import { titleFromFilename } from '../src/lib/ingest/extract';

const CONTENT_DIR = join(process.cwd(), 'content');
const CORPUS_GLOB = /^0\d.*\.md$/;

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

function corpusFiles(): string[] {
  const files = readdirSync(CONTENT_DIR).filter((f) => CORPUS_GLOB.test(f)).sort();
  if (files.length === 0) {
    throw new Error(`No corpus documents matched ${CORPUS_GLOB} in ${CONTENT_DIR}`);
  }
  return files;
}

function chunkAll() {
  return corpusFiles().map((file) => {
    const title = titleFromFilename(file);
    const chunks = chunkMarkdown(readFileSync(join(CONTENT_DIR, file), 'utf8'), title);
    return { file, title, chunks };
  });
}

async function runDry() {
  const documents = chunkAll();
  let totalChunks = 0;
  let totalTokens = 0;

  for (const { file, chunks } of documents) {
    const tokens = chunks.reduce((n, c) => n + c.tokenCount, 0);
    totalChunks += chunks.length;
    totalTokens += tokens;

    const sizes = chunks.map((c) => c.tokenCount);
    console.log(
      `${file.padEnd(36)} ${String(chunks.length).padStart(3)} chunks  ` +
        `${String(tokens).padStart(5)} tok  ` +
        `min ${Math.min(...sizes)} / max ${Math.max(...sizes)}`,
    );

    if (verbose) {
      for (const chunk of chunks) {
        console.log(`   [${String(chunk.index).padStart(2)}] ${chunk.tokenCount
          .toString()
          .padStart(3)} tok  ${chunk.headingPath}`);
      }
    }
  }

  // voyage-4-large is $0.12 per 1M tokens, against a 200M free allowance.
  const cost = (totalTokens / 1_000_000) * 0.12;

  console.log('');
  console.log(`${documents.length} documents, ${totalChunks} chunks, ~${totalTokens} tokens`);
  console.log(`Embedding cost if run for real: $${cost.toFixed(4)}`);
  console.log('');
  console.log('Dry run — nothing was embedded or written. Run `npm run seed` to index.');
}

async function runReal() {
  // Imported lazily so the dry run works with no credentials configured.
  const { ingest } = await import('../src/lib/ingest');
  const { getSupabase } = await import('../src/lib/supabase');

  const files = corpusFiles();
  const supabase = getSupabase();

  console.log(`Seeding ${files.length} documents...\n`);

  let totalChunks = 0;
  let totalTokens = 0;
  const failures: string[] = [];

  for (const file of files) {
    // Re-seeding is the normal case while tuning chunking, so replace rather than duplicate.
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('source_ref', file);

    for (const row of existing ?? []) {
      await supabase.from('documents').delete().eq('id', row.id);
    }

    try {
      const result = await ingest({
        input: {
          type: 'file',
          buffer: readFileSync(join(CONTENT_DIR, file)),
          filename: file,
        },
      });

      totalChunks += result.chunkCount;
      totalTokens += result.tokensEmbedded;
      console.log(
        `  ok    ${file.padEnd(36)} ${String(result.chunkCount).padStart(3)} chunks  ` +
          `${String(result.tokensEmbedded).padStart(5)} tok`,
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      failures.push(`${file}: ${message}`);
      console.error(`  FAIL  ${file.padEnd(36)} ${message}`);
    }
  }

  console.log('');
  console.log(`${totalChunks} chunks stored, ${totalTokens} tokens embedded.`);

  if (failures.length) {
    console.error(`\n${failures.length} document(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('Corpus indexed. Retrieval is not built yet — that is Phase 2.');
}

(dryRun ? runDry() : runReal()).catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
