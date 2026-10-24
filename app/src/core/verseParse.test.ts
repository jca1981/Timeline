import { describe, it, expect } from 'vitest';
import { parseVerseRefs, formatVerseRefs } from './verseParse';

describe('parseVerseRefs', () => {
  it('parses simple chapter ref', () => {
    expect(parseVerseRefs('Gen 1')).toEqual([{ bookSlug: 'Gen', ch: 1 }]);
  });

  it('parses chapter:verse', () => {
    expect(parseVerseRefs('Jes 9:6')).toEqual([{ bookSlug: 'Jes', ch: 9, vs: 6 }]);
  });

  it('parses chapter:verse range', () => {
    expect(parseVerseRefs('1Kong 3:5-12')).toEqual([{ bookSlug: '1Kong', ch: 3, vs: 5, vsEnd: 12 }]);
  });

  it('parses multiple comma-separated refs', () => {
    const r = parseVerseRefs('Gen 1:1-3, Eks 20');
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ bookSlug: 'Gen', ch: 1, vs: 1, vsEnd: 3 });
    expect(r[1]).toEqual({ bookSlug: 'Eks', ch: 20 });
  });

  it('returns empty for invalid input', () => {
    expect(parseVerseRefs('not a ref')).toEqual([]);
    expect(parseVerseRefs('')).toEqual([]);
  });

  it('handles Danish characters in book names', () => {
    const r = parseVerseRefs('1Krøn 16');
    expect(r[0].bookSlug).toBe('1Krøn');
  });

  it('formatVerseRefs roundtrips', () => {
    const refs = [{ bookSlug: 'Gen', ch: 1, vs: 1, vsEnd: 3 }];
    expect(formatVerseRefs(refs)).toBe('Gen 1:1-3');
  });
});
