/**
 * Markdown-aware chunking.
 *
 * Naive fixed-size chunking would destroy this corpus. The fee guide is almost entirely
 * markdown tables; splitting at an arbitrary character offset produces a chunk like
 * "| Porcelain crown | £780 |" with no header row and no heading, which embeds as a
 * meaningless string of tokens and retrieves for nothing.
 *
 * So: split on headings, keep tables intact, and prepend a breadcrumb to every chunk.
 */

/** Rough English estimate. Used only for boundary decisions, never for billing. */
const CHARS_PER_TOKEN = 4;

const MAX_TOKENS = 500;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

/**
 * Blocks smaller than this are carried into the next chunk as overlap. Roughly 15% of the
 * budget, matching the spec, but applied at block granularity so a table row is never
 * orphaned from its header.
 */
const OVERLAP_CHARS = Math.floor(MAX_CHARS * 0.15);

export interface Chunk {
  index: number;
  /** e.g. "Private Fee Guide > Crowns, bridges and dentures" */
  headingPath: string;
  /** Breadcrumb + body. This is both what gets embedded and what Claude receives. */
  content: string;
  tokenCount: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

interface Section {
  headingPath: string;
  body: string;
}

const isTableLine = (line: string) => line.trimStart().startsWith('|');

/**
 * Split markdown into sections on H2 and H3 boundaries, tracking the heading path.
 * An H1 becomes the document title when the caller has not supplied one.
 */
function splitIntoSections(markdown: string, fallbackTitle: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];

  let title = fallbackTitle;
  let h2 = '';
  let h3 = '';
  let buffer: string[] = [];

  const pathNow = () => [title, h2, h3].filter(Boolean).join(' > ');

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body) sections.push({ headingPath: pathNow(), body });
    buffer = [];
  };

  for (const line of lines) {
    const h1Match = /^#\s+(.+)$/.exec(line);
    const h2Match = /^##\s+(.+)$/.exec(line);
    const h3Match = /^###\s+(.+)$/.exec(line);

    if (h1Match) {
      flush();
      title = h1Match[1].trim();
      h2 = '';
      h3 = '';
    } else if (h2Match) {
      flush();
      h2 = h2Match[1].trim();
      h3 = '';
    } else if (h3Match) {
      flush();
      h3 = h3Match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Split a section body into blocks on blank lines. Markdown tables contain no blank lines,
 * so a table survives this as a single block — which is exactly what we want.
 */
function splitIntoBlocks(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * Split an oversized table into row groups, repeating the header and separator rows in every
 * piece. Without the repeat, the continuation chunks are rows of numbers with no column names.
 */
function splitTable(table: string): string[] {
  const lines = table.split('\n');
  const header = lines.slice(0, 2);
  const rows = lines.slice(2);

  // Not a real table (no separator row) — fall back to line-wise splitting.
  if (header.length < 2 || !header[1].includes('-')) return splitLines(lines);

  const headerText = header.join('\n');
  const out: string[] = [];
  let current: string[] = [];

  for (const row of rows) {
    const candidate = [headerText, ...current, row].join('\n');
    if (current.length > 0 && candidate.length > MAX_CHARS) {
      out.push([headerText, ...current].join('\n'));
      current = [row];
    } else {
      current.push(row);
    }
  }
  if (current.length) out.push([headerText, ...current].join('\n'));

  return out;
}

/** Last resort for an oversized non-table block: pack whole lines, never splitting one. */
function splitLines(lines: string[]): string[] {
  const out: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (current.length > 0 && [...current, line].join('\n').length > MAX_CHARS) {
      out.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) out.push(current.join('\n'));

  return out;
}

/** Break a block that exceeds the budget into pieces that fit. */
function splitOversizedBlock(block: string): string[] {
  const lines = block.split('\n');
  if (lines.length > 1 && lines.every((l) => !l.trim() || isTableLine(l))) {
    return splitTable(block);
  }

  // Prose: pack sentences, then fall back to lines if a single sentence is still too long.
  const sentences = block.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [block];
  const out: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current && (current + sentence).length > MAX_CHARS) {
      out.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) out.push(current.trim());

  return out.flatMap((piece) => (piece.length > MAX_CHARS ? splitLines(piece.split('\n')) : piece));
}

/**
 * Chunk a markdown document.
 *
 * @param markdown Raw markdown.
 * @param fallbackTitle Used as the document title when the file has no H1.
 */
export function chunkMarkdown(markdown: string, fallbackTitle: string): Chunk[] {
  const sections = splitIntoSections(markdown, fallbackTitle);
  const chunks: Chunk[] = [];

  const push = (headingPath: string, body: string) => {
    const content = `${headingPath}\n\n${body}`;
    chunks.push({
      index: chunks.length,
      headingPath,
      content,
      tokenCount: estimateTokens(content),
    });
  };

  for (const section of sections) {
    const budget = MAX_CHARS - section.headingPath.length - 2;

    if (section.body.length <= budget) {
      push(section.headingPath, section.body);
      continue;
    }

    // Expand any block that is individually too large, then greedily pack.
    const blocks = splitIntoBlocks(section.body).flatMap((b) =>
      b.length > budget ? splitOversizedBlock(b) : b,
    );

    let current: string[] = [];
    let length = 0;

    const flushChunk = () => {
      if (!current.length) return;
      push(section.headingPath, current.join('\n\n'));

      // Carry the trailing block forward as overlap, if it is small enough to be worth it.
      const last = current[current.length - 1];
      if (last.length <= OVERLAP_CHARS && current.length > 1) {
        current = [last];
        length = last.length;
      } else {
        current = [];
        length = 0;
      }
    };

    for (const block of blocks) {
      if (current.length && length + block.length + 2 > budget) flushChunk();
      current.push(block);
      length += block.length + 2;
    }

    // Final flush must not re-seed overlap, or we emit a duplicate tail chunk.
    if (current.length) push(section.headingPath, current.join('\n\n'));
  }

  return chunks.map((c, i) => ({ ...c, index: i }));
}
