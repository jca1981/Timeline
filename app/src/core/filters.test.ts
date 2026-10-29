// **** Tests for filter-logik (M4) ****
import { describe, it, expect } from 'vitest';
import { applyFilter, matchesFilter } from './filters';
import { toJD } from './jdn';
import type { Filter, Item } from '../model/doc';

const items: Item[] = [
  { id: '1', typeId: 'person', label: 'David', span: { start: { y: -1000, precision: 'year' }, end: { y: -930, precision: 'year' } }, tags: ['konge', 'psalme'] },
  { id: '2', typeId: 'event', label: 'Udgangen', span: { start: { y: -1500, precision: 'year' } }, tags: ['udgang'] },
  { id: '3', typeId: 'person', label: 'Paulus', span: { start: { y: 5, precision: 'year' }, end: { y: 67, precision: 'year' } }, tags: ['apostel'] },
  { id: '4', typeId: 'place', label: 'Jerusalem', span: {}, notes: 'Hellig by' },
  { id: '5', typeId: 'person', label: 'Salomo', span: { start: { y: -970, precision: 'year' }, end: { y: -930, precision: 'year' } }, tags: ['konge'], notes: 'Byggede templet' },
];

describe('matchesFilter', () => {
  it('null filter → all pass', () => {
    items.forEach((it) => expect(matchesFilter(it, null)).toBe(true));
  });

  it('type filter', () => {
    const f: Filter = { match: 'all', types: ['person'] };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched.map((it) => it.id)).toEqual(['1', '3', '5']);
  });

  it('tag filter', () => {
    const f: Filter = { match: 'all', tags: ['konge'] };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched.map((it) => it.id)).toEqual(['1', '5']);
  });

  it('text filter', () => {
    const f: Filter = { match: 'all', text: 'templet' };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched.map((it) => it.id)).toEqual(['5']);
  });

  it('date range filter (overlaps)', () => {
    // range: -1000 to -900 → David (-1000..-930) and Salomo (-970..-930) overlap
    const f: Filter = { match: 'all', dateRange: { from: toJD({ y: -1000, precision: 'year' }), to: toJD({ y: -900, precision: 'year' }) } };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched.map((it) => it.label)).toContain('David');
    expect(matched.map((it) => it.label)).toContain('Salomo');
    expect(matched.map((it) => it.label)).not.toContain('Udgangen'); // -1500 → before range
  });

  it('item with no dates always included in date range filter', () => {
    const f: Filter = { match: 'all', dateRange: { from: toJD({ y: 2000, precision: 'year' }) } };
    // Jerusalem has no dates → should be included (uncertain = include)
    expect(matchesFilter(items[3], f)).toBe(true);
  });

  it('combined filter with match=all', () => {
    const f: Filter = {
      match: 'all',
      types: ['person'],
      text: 'salomo',
    };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched).toHaveLength(1);
    expect(matched[0].label).toBe('Salomo');
  });

  it('match=any → OR logic', () => {
    const f: Filter = { match: 'any', types: ['event'], tags: ['apostel'] };
    const matched = items.filter((it) => matchesFilter(it, f));
    expect(matched.map((it) => it.label)).toEqual(['Udgangen', 'Paulus']);
  });
});

describe('applyFilter', () => {
  it('returns all when filter is null', () => {
    expect(applyFilter(items, null)).toHaveLength(5);
  });

  it('returns subset when filtered', () => {
    const f: Filter = { match: 'all', types: ['place'] };
    expect(applyFilter(items, f)).toHaveLength(1);
  });
});

describe('parentId filter (M12)', () => {
  const tree: Item[] = [
    { id: 'root', typeId: 'event', label: 'Patriarker', span: { start: { y: -2000, precision: 'year' }, end: { y: -1700, precision: 'year' } } },
    { id: 'ab', typeId: 'person', label: 'Abraham', span: { start: { y: -1900, precision: 'year' } }, parentId: 'root' },
    { id: 'isak', typeId: 'person', label: 'Isak', span: { start: { y: -1850, precision: 'year' } }, parentId: 'ab' },
    { id: 'jakob', typeId: 'person', label: 'Jakob', span: { start: { y: -1800, precision: 'year' } }, parentId: 'ab' },
    { id: 'moses', typeId: 'person', label: 'Moses', span: { start: { y: -1500, precision: 'year' } } },
  ];

  it('filters to parent + descendants only', () => {
    const f: Filter = { match: 'all', parentId: 'ab' };
    const result = applyFilter(tree, f);
    expect(result.map((i) => i.id)).toEqual(['ab', 'isak', 'jakob']);
  });

  it('parent itself matches when no filter excludes it', () => {
    const f: Filter = { match: 'all', parentId: 'root' };
    const result = applyFilter(tree, f);
    expect(result.map((i) => i.id)).toEqual(['root', 'ab', 'isak', 'jakob']);
  });

  it('parentId + types combined', () => {
    const f: Filter = { match: 'all', parentId: 'root', types: ['event'] };
    const result = applyFilter(tree, f);
    expect(result.map((i) => i.id)).toEqual(['root']);
  });
});

// **** Regression: issue #10 — parentId-cyklus må ikke hænge i BFS ****
describe('issue #10 cyklus-værn', () => {
  it('applyFilter med parentId-cyklus returnerer uden at hænge', () => {
    const cyc: Item[] = [
      { id: 'a', typeId: 'event', label: 'A', span: {}, parentId: 'b' },
      { id: 'b', typeId: 'event', label: 'B', span: {}, parentId: 'a' },
    ];
    const out = applyFilter(cyc, { parentId: 'a' } as Filter);
    expect(out.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });
});
