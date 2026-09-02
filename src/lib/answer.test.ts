/**
 * Marker parsing.
 *
 * Every shape here was either observed from the live model or is one formatting step away from
 * one that was. A misparse is worse than it sounds: the reply reads correctly to a visitor while
 * being logged with the wrong answered/unanswered flag, which silently corrupts the gaps
 * dashboard the clinic is meant to act on — and, in testing, looks identical to a hallucination.
 */

import { describe, expect, it } from 'vitest';
import { parse } from './answer';

const chunks = [{ id: 'chunk-a' }, { id: 'chunk-b' }, { id: 'chunk-c' }];

describe('parse', () => {
  describe('marker shapes', () => {
    const refusals = [
      ['bare on its own line', 'NO_ANSWER\nWe do not have that.'],
      ['blank line after', 'NO_ANSWER\n\nWe do not have that.'],
      ['bold', '**NO_ANSWER**\nWe do not have that.'],
      ['bold, inline', '**NO_ANSWER** We do not have that.'],
      ['inline, single space', 'NO_ANSWER We do not have that.'],
      ['with a colon', 'NO_ANSWER: We do not have that.'],
      ['with a dash', 'NO_ANSWER - We do not have that.'],
      ['lowercase', 'no_answer\nWe do not have that.'],
      ['leading whitespace', '   NO_ANSWER\nWe do not have that.'],
      ['backticked', '`NO_ANSWER`\nWe do not have that.'],
      ['heading', '## NO_ANSWER\nWe do not have that.'],
    ] as const;

    for (const [label, raw] of refusals) {
      it(`reads a refusal ${label}`, () => {
        const result = parse(raw, chunks);
        expect(result.answered).toBe(false);
        expect(result.text).toBe('We do not have that.');
      });
    }

    const answers = [
      ['bare', 'ANSWERED\nWe are open until 4pm.'],
      ['bold', '**ANSWERED**\nWe are open until 4pm.'],
      ['inline', 'ANSWERED We are open until 4pm.'],
      ['lowercase', 'answered\nWe are open until 4pm.'],
    ] as const;

    for (const [label, raw] of answers) {
      it(`reads an answer ${label}`, () => {
        const result = parse(raw, chunks);
        expect(result.answered).toBe(true);
        expect(result.text).toBe('We are open until 4pm.');
      });
    }
  });

  describe('marker precedence', () => {
    // NO_ANSWER must not be read as the word ANSWERED appearing inside it.
    it('does not mistake NO_ANSWER for ANSWERED', () => {
      expect(parse('NO_ANSWER\nNope.', chunks).answered).toBe(false);
    });

    it('ignores a marker word appearing later in the body', () => {
      const result = parse('ANSWERED\nWe cannot say NO_ANSWER to everything.', chunks);
      expect(result.answered).toBe(true);
      expect(result.text).toBe('We cannot say NO_ANSWER to everything.');
    });
  });

  describe('double markers', () => {
    // Observed live: the model writes one marker, reconsiders, and writes the other before a
    // correct refusal. Reading only the first scored these as fabrications.
    it('treats ANSWERED then NO_ANSWER as a refusal', () => {
      const result = parse("ANSWERED\nNO_ANSWER\n\nWe don't have that.", chunks);
      expect(result.answered).toBe(false);
      expect(result.text).toBe("We don't have that.");
    });

    it('treats NO_ANSWER then ANSWERED as a refusal too', () => {
      // Order does not rescue it. A reply that said it could not answer is not an answer.
      expect(parse('NO_ANSWER\nANSWERED\n\nWe are open.', chunks).answered).toBe(false);
    });

    it('handles a repeated ANSWERED', () => {
      const result = parse('ANSWERED\nANSWERED\n\nWe are open until 4pm.', chunks);
      expect(result.answered).toBe(true);
      expect(result.text).toBe('We are open until 4pm.');
    });

    it('stops consuming after three markers so a body cannot be eaten', () => {
      const result = parse('ANSWERED\nANSWERED\nANSWERED\nANSWERED\nreal body', chunks);
      expect(result.text).toBe('ANSWERED\nreal body');
    });
  });

  describe('failing closed', () => {
    it('treats a missing marker as a refusal', () => {
      const result = parse('We are open until 4pm.', chunks);
      expect(result.answered).toBe(false);
      expect(result.hadMarker).toBe(false);
      expect(result.text).toBe('We are open until 4pm.');
    });
  });

  describe('sources', () => {
    it('maps source numbers to chunk ids', () => {
      const result = parse('ANSWERED\nWe are open until 4pm.\nSOURCES: 1, 3', chunks);
      expect(result.citedChunkIds).toEqual(['chunk-a', 'chunk-c']);
      expect(result.text).toBe('We are open until 4pm.');
    });

    it('drops out-of-range source numbers rather than throwing', () => {
      const result = parse('ANSWERED\nOpen until 4pm.\nSOURCES: 1, 9', chunks);
      expect(result.citedChunkIds).toEqual(['chunk-a']);
    });

    it('handles a reply with no sources line', () => {
      const result = parse('NO_ANSWER\nWe do not have that.', chunks);
      expect(result.citedChunkIds).toEqual([]);
    });

    it('is case insensitive on the sources label', () => {
      expect(parse('ANSWERED\nOpen.\nsources: 2', chunks).citedChunkIds).toEqual(['chunk-b']);
    });
  });
});
