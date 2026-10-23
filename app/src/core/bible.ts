// **** Bibel-vers: formatering + jw.org StudieBibel-deep link (M3) ****
import { BOOK_BY_SLUG } from '../model/bibleBooks';
import type { VerseRef } from '../model/doc';

/** Deep link til kapitel på jw.org (dansk Studiebibel). Vers gradueres ikke i URL — kapitel+vers vises i label. */
export function jwUrl(ref: VerseRef): string {
  const slug = encodeURIComponent(ref.bookSlug);
  return `https://www.jw.org/da/bibliotek/bibelen/studiebibel/b%C3%B8ger/${slug}/${ref.ch}/`;
}

/** "Mattæus 2:1–12" (forkortelse hvis forkortet=true). */
export function formatVerse(ref: VerseRef, abbr = false): string {
  const b = BOOK_BY_SLUG.get(ref.bookSlug);
  const name = b ? (abbr ? b.abbr : b.name) : ref.bookSlug;
  let out = `${name} ${ref.ch}`;
  if (ref.vs) out += `:${ref.vs}`;
  if (ref.vsEnd) out += `–${ref.vsEnd}`;
  return out;
}
