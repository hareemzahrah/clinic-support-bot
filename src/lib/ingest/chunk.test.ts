import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chunkMarkdown, estimateTokens } from './chunk';

const CONTENT_DIR = join(process.cwd(), 'content');
const MAX_TOKENS = 500;

/** Only the numbered documents are corpus. content/README.md must never be indexed. */
const corpusFiles = readdirSync(CONTENT_DIR).filter((f) => /^0\d.*\.md$/.test(f));

const loadCorpus = () =>
  corpusFiles.map((file) => ({
    file,
    chunks: chunkMarkdown(readFileSync(join(CONTENT_DIR, file), 'utf8'), file),
  }));

describe('chunkMarkdown', () => {
  it('gives every chunk a heading path', () => {
    const chunks = chunkMarkdown('# Doc\n\n## Section\n\nSome text.', 'fallback');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe('Doc > Section');
  });

  it('uses the fallback title when there is no H1', () => {
    const chunks = chunkMarkdown('## Section\n\nSome text.', 'Fallback Title');
    expect(chunks[0].headingPath).toBe('Fallback Title > Section');
  });

  it('includes H3 in the heading path', () => {
    const chunks = chunkMarkdown('# Doc\n\n## Two\n\n### Three\n\nText.', 'x');
    expect(chunks.at(-1)!.headingPath).toBe('Doc > Two > Three');
  });

  it('prepends the breadcrumb to the embedded content', () => {
    const chunks = chunkMarkdown('# Fee Guide\n\n## Crowns\n\nPorcelain £780.', 'x');
    expect(chunks[0].content.startsWith('Fee Guide > Crowns')).toBe(true);
    expect(chunks[0].content).toContain('£780');
  });

  it('numbers chunks contiguously from zero', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Paragraph number ${i}. `.repeat(20)).join(
      '\n\n',
    );
    const chunks = chunkMarkdown(`# Doc\n\n## Section\n\n${long}`, 'x');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it('repeats the header row when a table is split', () => {
    const rows = Array.from({ length: 120 }, (_, i) => `| Treatment ${i} | £${100 + i} |`).join(
      '\n',
    );
    const table = `# Fees\n\n## All\n\n| Treatment | Fee |\n|---|---|\n${rows}`;
    const chunks = chunkMarkdown(table, 'x');

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content).toContain('| Treatment | Fee |');
    }
  });

  it('never emits a table row without its header', () => {
    const rows = Array.from({ length: 200 }, (_, i) => `| Item ${i} | £${i} |`).join('\n');
    const chunks = chunkMarkdown(`# D\n\n## S\n\n| Item | Cost |\n|---|---|\n${rows}`, 'x');

    for (const chunk of chunks) {
      const body = chunk.content.split('\n\n').slice(1).join('\n\n');
      const hasDataRow = body.split('\n').some((l) => /^\|\s*Item \d+/.test(l));
      if (hasDataRow) expect(body).toContain('| Item | Cost |');
    }
  });

  it('produces no empty chunks', () => {
    const chunks = chunkMarkdown('# D\n\n## A\n\n\n\n## B\n\nReal content.', 'x');
    for (const chunk of chunks) {
      expect(chunk.content.split('\n\n').slice(1).join('').trim().length).toBeGreaterThan(0);
    }
  });

  it('does not duplicate the trailing block', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => `Block ${i}. ${'word '.repeat(60)}`);
    const chunks = chunkMarkdown(`# D\n\n## S\n\n${blocks.join('\n\n')}`, 'x');

    const lastMarker = 'Block 11.';
    const occurrences = chunks.filter((c) => c.content.includes(lastMarker)).length;
    expect(occurrences).toBe(1);
  });
});

describe('the real corpus', () => {
  it('finds all eight documents', () => {
    expect(corpusFiles).toHaveLength(8);
  });

  it('keeps every chunk within roughly the token budget', () => {
    for (const { file, chunks } of loadCorpus()) {
      for (const chunk of chunks) {
        // 1.1x tolerance: a single indivisible table row may push slightly over.
        expect(chunk.tokenCount, `${file} chunk ${chunk.index}`).toBeLessThanOrEqual(
          MAX_TOKENS * 1.1,
        );
      }
    }
  });

  it('keeps the crown price with its column headers', () => {
    const feeGuide = loadCorpus().find((c) => c.file.startsWith('02'))!;
    const withPrice = feeGuide.chunks.filter((c) => c.content.includes('£780'));

    expect(withPrice.length).toBeGreaterThan(0);
    for (const chunk of withPrice) {
      expect(chunk.content).toContain('| Treatment | Fee |');
      expect(chunk.headingPath).toContain('Fee Guide');
    }
  });

  it('keeps NHS band charges with the band names', () => {
    const nhs = loadCorpus().find((c) => c.file.startsWith('03'))!;
    const withBand = nhs.chunks.filter((c) => c.content.includes('£332.10'));

    expect(withBand.length).toBeGreaterThan(0);
    for (const chunk of withBand) {
      expect(chunk.content).toContain('Band 3');
    }
  });

  it('loses no content — every heading survives into some chunk', () => {
    for (const { file, chunks } of loadCorpus()) {
      const source = readFileSync(join(CONTENT_DIR, file), 'utf8');
      const headings = [...source.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
      const paths = chunks.map((c) => c.headingPath).join('\n');

      for (const heading of headings) {
        expect(paths, `${file} lost heading "${heading}"`).toContain(heading);
      }
    }
  });

  it('reports a sane total chunk count', () => {
    const total = loadCorpus().reduce((n, c) => n + c.chunks.length, 0);
    // Corpus is ~5,100 words. Far below ~20 means sections are being dropped; far above
    // ~200 means it is shredding into fragments too small to answer anything.
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(200);
  });
});

describe('estimateTokens', () => {
  it('scales with length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});
