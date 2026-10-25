// **** Test af kilde-hjælp (M28): sikre links, citat-indeks, nummerering ****
import { describe, it, expect } from 'vitest';
import { bibliography, citationsBySource, citeLabel, findDuplicateSource, safeUrl, sourcesOf } from './sources';
import { emptyDoc, newId, type Item, type Source } from '../model/doc';

function mk(label: string, sourceIds?: string[]): Item {
  return { id: newId(), typeId: 't-event', label, span: {}, ...(sourceIds ? { sourceIds } : {}) };
}

describe('safeUrl', () => {
  it('accepterer http/https og sætter protokol på bare værter', () => {
    expect(safeUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeUrl('www.example.org')).toBe('https://www.example.org/');
  });

  it('afviser javascript: og data: — de er XSS i et <a href>', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('')).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});

describe('citeLabel', () => {
  it('sætter titel og lokator sammen', () => {
    const s: Source = { id: 'x', title: 'Studiebibelen', locator: 's. 214' };
    expect(citeLabel(s)).toBe('Studiebibelen — s. 214');
    expect(citeLabel({ id: 'y', title: 'Studiebibelen' })).toBe('Studiebibelen');
  });
});

describe('citationsBySource / sourcesOf', () => {
  it('tæller citater pr. kilde og ignorerer døde id’er', () => {
    const doc = emptyDoc('K');
    doc.sources = [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }];
    doc.items = [mk('a', ['s1', 's2']), mk('b', ['s1']), mk('c', ['sforsvundet'])];
    const cites = citationsBySource(doc);
    expect(cites.get('s1')!.length).toBe(2);
    expect(cites.get('s2')!.length).toBe(1);
    expect(cites.get('sforsvundet')).toBeUndefined();
    expect(sourcesOf(doc, doc.items[2]).length).toBe(0); // post med dod id viser ingen kilde
  });

  it('viser tom liste for en post uden sourceIds', () => {
    const doc = emptyDoc('K2');
    doc.sources = [{ id: 's1', title: 'A' }];
    const it = mk('a');
    expect(sourcesOf(doc, it)).toEqual([]);
  });
});

describe('bibliography', () => {
  it('nummererer kilder i den rækkefølge de optræder, og kun én gang pr. post', () => {
    const doc = emptyDoc('B');
    doc.sources = [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }, { id: 's3', title: 'C' }];
    const a = mk('a', ['s2', 's1', 's2']);
    const b = mk('b', ['s3']);
    const bib = bibliography(doc, [a, b]);
    // rækkefølge efter brug, ikke efter kilde-listen: s2 citeres først
    expect(bib.list.map((s) => s.title)).toEqual(['B', 'A', 'C']);
    expect(bib.numbers.get(a.id)).toEqual([1, 2]); // dobbelt-citat tæller kun én gang pr. post
    expect(bib.numbers.get(b.id)).toEqual([3]);
  });

  it('udelader kilder der ikke er citeret af de oplyste poster', () => {
    const doc = emptyDoc('B2');
    doc.sources = [{ id: 's1', title: 'A' }, { id: 's2', title: 'Ubegrundet' }];
    const bib = bibliography(doc, [mk('a', ['s1'])]);
    expect(bib.list.map((s) => s.id)).toEqual(['s1']);
  });
});

describe('findDuplicateSource', () => {
  it('finder den samme kilde på trods af storinger, lokator og mellemrum', () => {
    const list = [{ id: 's1', title: 'Studiebibelen', locator: 's. 214' }] as Source[];
    expect(findDuplicateSource(list, { title: ' studiebibelen ', locator: 'S. 214' })!.id).toBe('s1');
    expect(findDuplicateSource(list, { title: 'Studiebibelen', locator: 's. 99' })).toBeUndefined();
    expect(findDuplicateSource(list, { title: 'Noget helt andet' })).toBeUndefined();
  });
});
