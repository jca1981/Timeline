// **** Tests: relationer — retning, matrix-opslag, generationer (M3) ****
import { describe, expect, it } from 'vitest';
import { demoDoc, emptyDoc, DEFAULT_RELATION_TYPES } from '../model/doc';
import { findRelation, fulfillmentArcs, generations, linksOf, relationTypes } from './relations';

describe('relationer', () => {
  const doc = demoDoc();

  it('demodokumentet har relationstyper og -relationer', () => {
    expect(relationTypes(doc).map((t) => t.id)).toEqual(['rt-parent', 'rt-fulfillment', 'rt-contemporary']);
    expect(doc.relations).toHaveLength(3);
  });

  it('linksOf giver korrekt retningsetiket (forælder vs. barn)', () => {
    const maria = linksOf(doc, 'i0');
    const jes = linksOf(doc, 'i1');
    expect(maria.find((l) => l.otherId === 'i1')?.label).toBe('Forælder');
    expect(jes.find((l) => l.otherId === 'i0')?.label).toBe('Barn');
  });

  it('profeti-hentet-om relation vises i begge ender', () => {
    expect(linksOf(doc, 'i5').find((l) => l.otherId === 'i1')?.label).toBe('Opfyldt af');
    expect(linksOf(doc, 'i1').find((l) => l.otherId === 'i5')?.label).toBe('Opfylder');
  });

  it('findRelation matcher kun helt specifikt par', () => {
    expect(findRelation(doc, 'i0', 'i1', 'rt-parent')).toBeTruthy();
    expect(findRelation(doc, 'i1', 'i0', 'rt-parent')).toBeUndefined(); // barn → forælder er modsat retning
    expect(findRelation(doc, 'i0', 'i1', 'rt-contemporary')).toBeUndefined();
  });

  it('generationer: direkte forælder = 1 led, kæde tæller led', () => {
    const d = emptyDoc();
    d.items = [
      { id: 'a', typeId: 't-person', label: 'Bedstefar', span: { start: { y: -100, precision: 'year' } } },
      { id: 'b', typeId: 't-person', label: 'Far', span: { start: { y: -70, precision: 'year' } } },
      { id: 'c', typeId: 't-person', label: 'Søn', span: { start: { y: -40, precision: 'year' } } },
    ];
    d.relations = [
      { id: 'r1', fromId: 'a', toId: 'b', typeId: 'rt-parent' },
      { id: 'r2', fromId: 'b', toId: 'c', typeId: 'rt-parent' },
    ];
    expect(generations(d, 'a', 'c')).toBe(2);
    expect(generations(d, 'a', 'b')).toBe(1);
    expect(generations(d, 'c', 'a')).toBe(-1); // forkert retning = ikke forbundet opefter
    expect(generations(d, 'a', 'x')).toBe(-1);
  });

  it('generationer tåler sløjfer', () => {
    const d = emptyDoc();
    d.items = [
      { id: 'x', typeId: 't-person', label: 'X', span: { start: { y: 1, precision: 'year' } } },
      { id: 'y', typeId: 't-person', label: 'Y', span: { start: { y: 1, precision: 'year' } } },
    ];
    d.relations = [
      { id: 'r1', fromId: 'x', toId: 'y', typeId: 'rt-parent' },
      { id: 'r2', fromId: 'y', toId: 'x', typeId: 'rt-parent' }, // ulovlig cyklus
    ];
    expect(generations(d, 'x', 'y')).toBe(1); // finder stadig direkte vej, uendelig løkke undgået
  });

  it('DEFAULT_RELATION_TYPES har navne i begge retninger', () => {
    for (const t of DEFAULT_RELATION_TYPES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.reverseName.length).toBeGreaterThan(0);
    }
  });

  it('fulfillmentArcs: demodok har en profeti→opfyldelse-relation', () => {
    const arcs = fulfillmentArcs(demoDoc());
    expect(arcs.length).toBeGreaterThanOrEqual(1);
    expect(arcs[0]).toHaveProperty('prophecyId');
    expect(arcs[0]).toHaveProperty('fulfillmentId');
  });

  it('fulfillmentArcs returnerer tom for doc uden relationer', () => {
    const arcs = fulfillmentArcs(emptyDoc('tom'));
    expect(arcs).toEqual([]);
  });
});
