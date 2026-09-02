/**
 * Semantic search over the indexed corpus.
 *
 * Returning zero chunks is a designed outcome, not a failure. The caller must treat it as
 * "the corpus does not answer this" and skip the model entirely — that path is what makes the
 * adversarial test set pass, and it costs nothing.
 */

import { embedQuery } from './embed';
import { getSupabase } from './supabase';

/**
 * Minimum cosine similarity for a chunk to be considered relevant.
 *
 * Measured, not guessed. `npm run tune` profiled both test sets against the real corpus on
 * 2026-09-02 and found they OVERLAP:
 *
 *   weakest genuine hit   0.319   ("how much notice do i need to give to cancel")
 *   strongest gap match   0.476   ("do you offer sedation for really nervous patients?")
 *   separation           -0.156
 *
 * No threshold separates them. Every value catching all 50 answerable questions also lets all
 * 15 unanswerable ones retrieve plausible-looking content. The spec assumed the threshold
 * would carry the refusals; it cannot. The grounding prompt has to.
 *
 * So this value has exactly one remaining job — discarding true nonsense before it reaches the
 * model — and is set below the genuine floor with margin rather than tuned for precision.
 * 0.25 gives 50/50 retrieval with roughly 0.07 of headroom, so a slightly weaker match in
 * future content does not silently start failing.
 *
 * Re-run `npm run tune` after any change to chunking, the embedding model, or the corpus.
 */
export const DEFAULT_THRESHOLD = 0.25;

/** How many chunks to send to the model. Five fits comfortably in the prompt budget. */
export const DEFAULT_TOP_K = 5;

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  headingPath: string;
  content: string;
  similarity: number;
}

export interface RetrieveOptions {
  threshold?: number;
  topK?: number;
}

export async function retrieve(
  question: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const topK = options.topK ?? DEFAULT_TOP_K;

  const queryEmbedding = await embedQuery(question);

  const { data, error } = await getSupabase().rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  return (data ?? []).map(
    (row: {
      id: string;
      document_id: string;
      document_title: string;
      heading_path: string;
      content: string;
      similarity: number;
    }) => ({
      id: row.id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      headingPath: row.heading_path,
      content: row.content,
      similarity: row.similarity,
    }),
  );
}
