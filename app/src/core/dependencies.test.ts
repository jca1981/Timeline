// **** Tests for dependency-logik (M4) ****
import { describe, it, expect } from 'vitest';
import {
  dependenciesOf,
  isDependencyViolated,
  validDependency,
  violatedDependencies,
} from './dependencies';
import { emptyDoc, type Dependency, type Item, type TimelineDoc } from '../model/doc';

function mkDoc(items: Item[], deps: Dependency[]): TimelineDoc {
  const doc = emptyDoc('test');
  doc.items = items;
  doc.dependencies = deps;
  return doc;
}

describe('isDependencyViolated', () => {
  const itemA: Item = { id: 'A', typeId: 't1', label: 'A', span: { start: { y: 2000, precision: 'year' }, end: { y: 2010, precision: 'year' } } };
  const itemB: Item = { id: 'B', typeId: 't1', label: 'B', span: { start: { y: 2005, precision: 'year' }, end: { y: 2015, precision: 'year' } } };
  const doc = mkDoc([itemA, itemB], []);

  it('FS: OK when A ends (2010) ≤ B starts (2005) → violated', () => {
    const dep: Dependency = { id: 'd1', blockerId: 'A', blockedId: 'B', kind: 'FS' };
    // A end (2010) > B start (2005) → violation
    expect(isDependencyViolated(dep, doc)).toBe(true);
  });

  it('FS: OK when A ends before B starts', () => {
    const itemC: Item = { id: 'C', typeId: 't1', label: 'C', span: { start: { y: 2020, precision: 'year' }, end: { y: 2030, precision: 'year' } } };
    const d2 = mkDoc([itemA, itemC], []);
    const dep: Dependency = { id: 'd2', blockerId: 'A', blockedId: 'C', kind: 'FS' };
    // A end (2010) ≤ C start (2020) → OK
    expect(isDependencyViolated(dep, d2)).toBe(false);
  });

  it('SS: OK when A starts before B starts', () => {
    const dep: Dependency = { id: 'd3', blockerId: 'A', blockedId: 'B', kind: 'SS' };
    // A start (2000) ≤ B start (2005) → OK
    expect(isDependencyViolated(dep, doc)).toBe(false);
  });

  it('FF: violated when A ends after B ends', () => {
    const dep: Dependency = { id: 'd4', blockerId: 'A', blockedId: 'B', kind: 'FF' };
    // A end (2010) ≤ B end (2015) → OK
    expect(isDependencyViolated(dep, doc)).toBe(false);
  });

  it('SF: violated when A starts after B ends', () => {
    const dep: Dependency = { id: 'd5', blockerId: 'A', blockedId: 'B', kind: 'SF' };
    // A start (2000) ≤ B end (2015) → OK
    expect(isDependencyViolated(dep, doc)).toBe(false);
  });

  it('missing dates → not violated (cannot evaluate)', () => {
    const noEnd: Item = { id: 'X', typeId: 't1', label: 'X', span: { start: { y: 100, precision: 'year' } } };
    const d = mkDoc([noEnd, itemB], []);
    const dep: Dependency = { id: 'd6', blockerId: 'X', blockedId: 'B', kind: 'FS' };
    expect(isDependencyViolated(dep, d)).toBe(false);
  });
});

describe('violatedDependencies', () => {
  it('returns only violated ones', () => {
    const itemA: Item = { id: 'A', typeId: 't1', label: 'A', span: { start: { y: 2000, precision: 'year' }, end: { y: 2010, precision: 'year' } } };
    const itemB: Item = { id: 'B', typeId: 't1', label: 'B', span: { start: { y: 2005, precision: 'year' }, end: { y: 2015, precision: 'year' } } };
    const deps: Dependency[] = [
      { id: 'd1', blockerId: 'A', blockedId: 'B', kind: 'FS' }, // violated (2010 > 2005)
      { id: 'd2', blockerId: 'A', blockedId: 'B', kind: 'SS' }, // OK (2000 ≤ 2005)
    ];
    const doc = mkDoc([itemA, itemB], deps);
    expect(violatedDependencies(doc)).toHaveLength(1);
    expect(violatedDependencies(doc)[0].id).toBe('d1');
  });
});

describe('dependenciesOf', () => {
  it('shows both blocker and blocked roles', () => {
    const deps: Dependency[] = [
      { id: 'd1', blockerId: 'A', blockedId: 'B', kind: 'FS' },
      { id: 'd2', blockerId: 'B', blockedId: 'C', kind: 'FS' },
    ];
    const doc = mkDoc([], deps);
    const result = dependenciesOf(doc, 'B');
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.id === 'd1')?.role).toBe('blocked');
    expect(result.find((d) => d.id === 'd2')?.role).toBe('blocker');
  });
});

describe('validDependency', () => {
  const items: Item[] = [
    { id: 'A', typeId: 't1', label: 'A', span: { start: { y: 2000, precision: 'year' } } },
    { id: 'B', typeId: 't1', label: 'B', span: { start: { y: 2010, precision: 'year' } } },
  ];
  const doc = mkDoc(items, []);

  it('rejects self-reference', () => {
    expect(validDependency(doc, 'A', 'A')).toBe('Kan ikke blokere sig selv');
  });

  it('rejects missing items', () => {
    expect(validDependency(doc, 'A', 'Z')).toBe('Blocked findes ikke');
  });

  it('accepts valid pair', () => {
    expect(validDependency(doc, 'A', 'B')).toBeNull();
  });
});
