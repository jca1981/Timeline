// **** Tests for parent/child-hierarki (M5) ****
import { describe, it, expect } from 'vitest';
import { buildTree, checkParentRanges, flattenTree } from './hierarchy';
import { emptyDoc, type Item, type TimelineDoc } from '../model/doc';

function mkDoc(items: Item[]): TimelineDoc {
  const doc = emptyDoc('test');
  doc.items = items;
  return doc;
}

const parent: Item = {
  id: 'p1', typeId: 'era', label: 'Kongedømmet',
  span: { start: { y: -1000, precision: 'year' }, end: { y: -586, precision: 'year' } },
};
const child1: Item = {
  id: 'c1', typeId: 'event', label: 'Salomo (OK)', parentId: 'p1',
  span: { start: { y: -970, precision: 'year' }, end: { y: -930, precision: 'year' } },
};
const child2: Item = {
  id: 'c2', typeId: 'event', label: 'Før forælder', parentId: 'p1',
  span: { start: { y: -1200, precision: 'year' }, end: { y: -1100, precision: 'year' } },
};
const child3: Item = {
  id: 'c3', typeId: 'event', label: 'Efter forælder', parentId: 'p1',
  span: { start: { y: -500, precision: 'year' }, end: { y: -400, precision: 'year' } },
};
const orphan: Item = {
  id: 'o1', typeId: 'event', label: 'Forælder slettet', parentId: 'gone',
  span: { start: { y: -900, precision: 'year' } },
};

describe('checkParentRanges', () => {
  it('child within parent range → no warning', () => {
    const doc = mkDoc([parent, child1]);
    expect(checkParentRanges(doc)).toHaveLength(0);
  });

  it('child starts before parent → warning', () => {
    const doc = mkDoc([parent, child2]);
    const w = checkParentRanges(doc);
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('Starter før');
  });

  it('child ends after parent → warning', () => {
    const doc = mkDoc([parent, child3]);
    const w = checkParentRanges(doc);
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('Slutter efter');
  });

  it('missing parent → warning', () => {
    const doc = mkDoc([orphan]);
    const w = checkParentRanges(doc);
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('findes ikke');
  });

  it('no parentId → not checked', () => {
    const doc = mkDoc([parent]);
    expect(checkParentRanges(doc)).toHaveLength(0);
  });

  it('parent without dates → no warning', () => {
    const noDateParent: Item = { id: 'p2', typeId: 'era', label: 'No dates', span: {} };
    const c: Item = { id: 'cx', typeId: 'x', label: 'X', parentId: 'p2', span: { start: { y: 2000, precision: 'year' } } };
    const doc = mkDoc([noDateParent, c]);
    expect(checkParentRanges(doc)).toHaveLength(0);
  });
});

describe('buildTree / flattenTree', () => {
  it('builds tree with correct depth', () => {
    const doc = mkDoc([parent, child1, child2]);
    const tree = buildTree(doc.items);
    expect(tree).toHaveLength(1);
    expect(tree[0].item.id).toBe('p1');
    expect(tree[0].children).toHaveLength(2);
    const flat = flattenTree(tree);
    expect(flat[0].depth).toBe(0); // parent
    expect(flat[1].depth).toBe(1); // child (sorted by year: c2 -1200 first, then c1 -970)
    expect(flat[1].item.id).toBe('c2'); // -1200 < -970
    expect(flat[2].item.id).toBe('c1');
  });

  it('orphan (missing parent) appears at root level', () => {
    const doc = mkDoc([parent, child1, orphan]);
    const tree = buildTree(doc.items);
    expect(tree).toHaveLength(2); // parent + orphan
  });

  it('multi-level hierarchy', () => {
    const g: Item = { id: 'g', typeId: 'x', label: 'Grandparent', span: { start: { y: -2000, precision: 'year' } } };
    const p: Item = { id: 'p', typeId: 'x', label: 'Parent', parentId: 'g', span: { start: { y: -1500, precision: 'year' } } };
    const c: Item = { id: 'c', typeId: 'x', label: 'Child', parentId: 'p', span: { start: { y: -1200, precision: 'year' } } };
    const doc = mkDoc([g, p, c]);
    const tree = buildTree(doc.items);
    const flat = flattenTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat[0].depth).toBe(0); // g
    expect(flat[1].depth).toBe(1); // p
    expect(flat[2].depth).toBe(2); // c
  });
});
