// **** M23: Vers-range-parser — konvertér tekst som "1Kong 1-11" til VerseRef[] ****
import type { VerseRef } from '../model/doc';

/**
 * Parser for simple vers-referencer.
 * Understøtter: "Gen 1:1-3", "1Kong 1", "2Krøn 5:2-10, 6:1", "Jes 9:6"
 * Format: [bog] kap:[start]-[slut], ...
 */
export function parseVerseRefs(input: string): VerseRef[] {
  const results: VerseRef[] = [];
  // Split on comma to handle multiple refs
  const parts = input.split(/,\s*/);
  for (const part of parts) {
    const m = part.trim().match(/^(\d?\s?[A-Z\w\æøåÆØÅ.]+)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
    if (m) {
      const ref: VerseRef = { bookSlug: m[1].replace(/\s+/g, ' '), ch: Number(m[2]) };
      if (m[3]) ref.vs = Number(m[3]);
      if (m[4]) ref.vsEnd = Number(m[4]);
      results.push(ref);
    }
  }
  return results;
}

/** Saml læsbar streng fra VerseRef[]. */
export function formatVerseRefs(refs: VerseRef[]): string {
  return refs.map((r) => `${r.bookSlug} ${r.ch}${r.vs ? ':' + r.vs : ''}${r.vsEnd ? '-' + r.vsEnd : ''}`).join(', ');
}
