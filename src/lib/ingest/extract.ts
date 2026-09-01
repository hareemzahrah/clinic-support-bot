/**
 * Turn a source into plain text.
 *
 * Deliberately small and dependency-isolated: each format lives behind a dynamic import, so a
 * broken PDF parser cannot stop a markdown file from being indexed. Ingestion of one document
 * must never take down ingestion of the rest.
 */

export type SourceType = 'file' | 'url' | 'text';

export interface Extracted {
  text: string;
  /** Best-guess document title, used when the content has no H1 of its own. */
  title: string;
}

export class UnsupportedFormatError extends Error {
  constructor(extension: string) {
    super(
      `Cannot extract text from "${extension}" files. Supported: .md, .txt, .pdf, .docx, and URLs.`,
    );
    this.name = 'UnsupportedFormatError';
  }
}

export class EmptyDocumentError extends Error {
  constructor(source: string) {
    super(
      `No text could be extracted from "${source}". If this is a scanned PDF it contains ` +
        'images rather than text and needs OCR before it can be indexed.',
    );
    this.name = 'EmptyDocumentError';
  }
}

const stripExtension = (filename: string) => filename.replace(/\.[^.]+$/, '');

/** "02-fee-guide" → "Fee Guide" */
function titleFromFilename(filename: string): string {
  return stripExtension(filename)
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractUrl(url: string): Promise<Extracted> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ClinicSupportBot/1.0 (+document ingestion)' },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const { load } = await import('cheerio');
  const $ = load(html);

  // Chrome, navigation and boilerplate are noise that dilutes the embedding.
  $('script, style, nav, header, footer, noscript, iframe, svg, form').remove();

  const title = $('h1').first().text().trim() || $('title').text().trim() || url;

  const root = $('main').length ? $('main') : $('article').length ? $('article') : $('body');

  const text = root
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, title };
}

/**
 * Extract text from a file buffer.
 *
 * @param buffer  File contents.
 * @param filename Original filename — its extension selects the parser.
 */
export async function extractFile(buffer: Buffer, filename: string): Promise<Extracted> {
  const extension = (/\.[^.]+$/.exec(filename)?.[0] ?? '').toLowerCase();
  let text: string;

  switch (extension) {
    case '.md':
    case '.markdown':
    case '.txt':
      text = buffer.toString('utf8');
      break;
    case '.pdf':
      text = await extractPdf(buffer);
      break;
    case '.docx':
      text = await extractDocx(buffer);
      break;
    default:
      throw new UnsupportedFormatError(extension || filename);
  }

  if (!text.trim()) throw new EmptyDocumentError(filename);

  return { text, title: titleFromFilename(filename) };
}

export async function extractSource(
  source: { type: 'file'; buffer: Buffer; filename: string } | { type: 'url'; url: string },
): Promise<Extracted> {
  if (source.type === 'url') {
    const result = await extractUrl(source.url);
    if (!result.text.trim()) throw new EmptyDocumentError(source.url);
    return result;
  }
  return extractFile(source.buffer, source.filename);
}

export { titleFromFilename };
