/**
 * Voyage AI embeddings.
 *
 * Called via fetch rather than the `voyageai` SDK: the REST surface is three fields wide and
 * documented, which is a smaller thing to get wrong than an SDK API.
 */

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

/**
 * voyage-4-large is Voyage's recommended model for retrieval and RAG. voyage-3-large, which
 * earlier drafts of the spec named, is deprecated.
 *
 * Cost is not a factor at this scale — current models carry a 200M free token allowance and
 * the whole corpus is roughly 7,000 tokens. Retrieval quality is the only thing being
 * optimised for here, because retrieval is where this project actually fails.
 */
export const EMBED_MODEL = 'voyage-4-large';

/** Must match `vector(1024)` in the schema. Changing this means re-indexing everything. */
export const EMBED_DIMENSIONS = 1024;

/**
 * Voyage allows 1,000 texts per request, but large models cap at 120K tokens per request.
 * At ~500 tokens per chunk that is ~240; 100 leaves comfortable headroom.
 */
const BATCH_SIZE = 100;

const MAX_RETRIES = 4;

/**
 * Documents and queries are embedded into deliberately different spaces. Passing the wrong
 * input_type degrades retrieval quality in a way that produces no error and is very hard to
 * notice by eye, so it is a required argument rather than an option with a default.
 */
export type InputType = 'document' | 'query';

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

export interface EmbedResult {
  embeddings: number[][];
  totalTokens: number;
}

function apiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      'VOYAGE_API_KEY is not set. Create a key at https://dashboard.voyageai.com and add it ' +
        'to .env.local (see .env.example).',
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(texts: string[], inputType: InputType): Promise<EmbedResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 500);

    let response: Response;
    try {
      response = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBED_MODEL,
          input: texts,
          input_type: inputType,
          output_dimension: EMBED_DIMENSIONS,
        }),
      });
    } catch (cause) {
      lastError = cause;
      continue; // Network error — retry.
    }

    if (response.ok) {
      const json = (await response.json()) as VoyageResponse;

      // Voyage documents that results come back in order, but the index field exists for a
      // reason. Sorting by it costs nothing and removes a silent misalignment bug where every
      // chunk would get someone else's embedding.
      const ordered = [...json.data].sort((a, b) => a.index - b.index);

      if (ordered.length !== texts.length) {
        throw new Error(
          `Voyage returned ${ordered.length} embeddings for ${texts.length} inputs.`,
        );
      }

      return {
        embeddings: ordered.map((d) => d.embedding),
        totalTokens: json.usage?.total_tokens ?? 0,
      };
    }

    const body = await response.text();

    // 429 and 5xx are worth retrying; 4xx means the request itself is wrong.
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Voyage API error ${response.status}: ${body}`);
    }
    lastError = new Error(`Voyage API error ${response.status}: ${body}`);
  }

  throw new Error(`Voyage API failed after ${MAX_RETRIES} retries: ${String(lastError)}`);
}

/**
 * Embed many texts, batching automatically. Order of the returned array matches the input.
 */
export async function embed(texts: string[], inputType: InputType): Promise<EmbedResult> {
  if (texts.length === 0) return { embeddings: [], totalTokens: 0 };

  const embeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await embedBatch(batch, inputType);
    embeddings.push(...result.embeddings);
    totalTokens += result.totalTokens;
  }

  return { embeddings, totalTokens };
}

/** Convenience wrapper for the single-query case in the retrieval path. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embeddings } = await embed([text], 'query');
  return embeddings[0];
}
