/**
 * The title a corpus document will carry once indexed.
 *
 * Ingest prefers a document's own top-level heading over its filename, so the test scorers have
 * to resolve expected titles the same way. Deriving them from the filename here instead would
 * make every retrieval test fail the moment a document's heading and filename differ in wording
 * — which they do, deliberately.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function corpusTitle(filename: string): string {
  const text = readFileSync(join(process.cwd(), 'content', filename), 'utf8');
  for (const line of text.split('\n', 5)) {
    const heading = line.match(/^#\s+(.+?)\s*$/);
    if (heading) return heading[1];
  }
  throw new Error(`${filename} has no top-level heading, so its indexed title is unpredictable.`);
}
