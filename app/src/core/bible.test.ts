// **** Tests: vers-formatering, jw.org-URL, bogekatalog (M3) ****
import { describe, expect, it } from 'vitest';
import { formatVerse, jwUrl } from './bible';
import { BOOKS, BOOK_BY_SLUG } from '../model/bibleBooks';

describe('bibelvers', () => {
  it('der er 66 bøger i kataloget', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOK_BY_SLUG.get('Matthæus')?.name).toBe('Matthæus');
    expect(BOOK_BY_SLUG.get('daniel')?.abbr).toBe('Dan.');
  });

  it('formaterer "Matthæus 2:1–12"', () => {
    expect(formatVerse({ bookSlug: 'Matthæus', ch: 2, vs: 1, vsEnd: 12 }).normalize('NFC')).toBe('Matthæus 2:1–12');
    expect(formatVerse({ bookSlug: 'daniel', ch: 9, vs: 24, vsEnd: 27 })).toBe('Daniel 9:24–27');
    expect(formatVerse({ bookSlug: 'daniel', ch: 9 })).toBe('Daniel 9');
  });

  it('forkortet form', () => {
    expect(formatVerse({ bookSlug: 'Matthæus', ch: 2, vs: 16 }, true)).toBe('Matt. 2:16');
  });

  it('jw.org-studiebibel-URL med UTF-8-sti', () => {
    const url = jwUrl({ bookSlug: 'Matthæus', ch: 2 });
    expect(url).toBe('https://www.jw.org/da/bibliotek/bibelen/studiebibel/b%C3%B8ger/Matth%C3%A6us/2/');
  });

  it('ukendt bogslug giver pæn fallback-label', () => {
    expect(formatVerse({ bookSlug: 'udtænkт', ch: 3, vs: 2 })).toBe('udtænkт 3:2');
  });
});
