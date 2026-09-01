/**
 * Ingestion orchestrator: source → text → chunks → embeddings → database.
 *
 * The document row is created first with status 'processing' and only flipped to 'ready' once
 * every chunk is stored. Retrieval filters on status = 'ready', so a document that fails
 * halfway through is invisible to the bot rather than partially visible — a half-indexed fee
 * guide would answer some price questions and silently miss others, which is worse than not
 * answering at all.
 */

import { getSupabase } from '@/lib/supabase';
import { embed } from '@/lib/embed';
import { chunkMarkdown, type Chunk } from './chunk';
import { extractSource, titleFromFilename } from './extract';

export interface IngestSource {
  /** File contents, or the URL to fetch. */
  input: { type: 'file'; buffer: Buffer; filename: string } | { type: 'url'; url: string };
  /** Overrides the title derived from the filename or page. */
  title?: string;
}

export interface IngestResult {
  documentId: string;
  title: string;
  chunkCount: number;
  tokensEmbedded: number;
}

export async function ingest(source: IngestSource): Promise<IngestResult> {
  const supabase = getSupabase();

  const sourceRef =
    source.input.type === 'url' ? source.input.url : source.input.filename;
  const provisionalTitle =
    source.title ??
    (source.input.type === 'file' ? titleFromFilename(source.input.filename) : sourceRef);

  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      title: provisionalTitle,
      source_type: source.input.type,
      source_ref: sourceRef,
      status: 'processing',
    })
    .select('id')
    .single();

  if (insertError || !document) {
    throw new Error(`Could not create document row: ${insertError?.message}`);
  }

  const documentId = document.id as string;

  try {
    const extracted = await extractSource(source.input);
    const title = source.title ?? extracted.title;

    const chunks = chunkMarkdown(extracted.text, title);
    if (chunks.length === 0) {
      throw new Error('Extraction succeeded but produced no chunks.');
    }

    const { embeddings, totalTokens } = await embed(
      chunks.map((c) => c.content),
      'document',
    );

    await storeChunks(documentId, chunks, embeddings);

    await supabase
      .from('documents')
      .update({ title, status: 'ready', error_message: null })
      .eq('id', documentId);

    return { documentId, title, chunkCount: chunks.length, tokensEmbedded: totalTokens };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    // Record why, then clear any partial chunks so a retry starts clean.
    await supabase
      .from('documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', documentId);
    await supabase.from('chunks').delete().eq('document_id', documentId);

    throw cause;
  }
}

async function storeChunks(documentId: string, chunks: Chunk[], embeddings: number[][]) {
  const supabase = getSupabase();

  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Embedding count (${embeddings.length}) does not match chunk count (${chunks.length}).`,
    );
  }

  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    chunk_index: chunk.index,
    heading_path: chunk.headingPath,
    content: chunk.content,
    token_count: chunk.tokenCount,
    embedding: embeddings[i],
  }));

  // Insert in batches — a single statement carrying hundreds of 1024-float vectors is large
  // enough to hit request size limits.
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('chunks').insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Could not store chunks: ${error.message}`);
  }
}

/** Delete a document and, by cascade, all of its chunks. */
export async function deleteDocument(documentId: string): Promise<void> {
  const { error } = await getSupabase().from('documents').delete().eq('id', documentId);
  if (error) throw new Error(`Could not delete document: ${error.message}`);
}
