// **** Tests: personer — levetid, familie, fødested, kilder (M30) ****
import { describe, expect, it } from 'vitest';
import { demoDoc, emptyDoc } from '../model/doc';
import type { TimelineDoc } from '../model/doc';
import { lifespanText, peopleOf, peopleStats, personTypeIds, sortPeople } from './people';

describe('personer', () => {
  const doc = demoDoc();

  it('finder person-typer (t-person) og ignorerer begivenelser', () => {
    const ids = personTypeIds(doc);
    expect(ids.has('t-person')).toBe(true);
    expect(ids.has('t-event')).toBe(false);
  });

  it('bygger rækker med forældre, børn og levetid', () => {
    const rows = peopleOf(doc);
    expect(rows.map((r) => r.item.label)).toEqual(['Maria (Jesus’ mor)', 'Jesus af Nazaret']);
    const maria = rows[0], jes = rows[1];
    expect(maria.children.map((c) => c.id)).toEqual(['i1']);
    expect(jes.parents.map((p) => p.id)).toEqual(['i0']);
    expect(lifespanText(maria)).toBe('f. 21 f.Kr. – d. 40');
    expect(jes.birth?.y).toBe(-3);
    expect(maria.cites).toBe(1); // usikker dato → studietavle-kilde
    expect(jes.cites).toBe(1); // vers → NWT-kilde
  });

  it('uden person-typer bruges familie-relationer som signal', () => {
    const d = emptyDoc('tom');
    d.itemTypes = [{ id: 'ting', name: 'Ting', color: '#888' }];
    d.items = [
      { id: 'a', typeId: 'ting', label: 'En eller anden', span: {} },
      { id: 'b', typeId: 'ting', label: 'Barnet', span: {} },
    ];
    d.relationTypes = [{ id: 'rt-parent', name: 'Forælder', reverseName: 'Barn' }];
    d.relations = [{ id: 'r', fromId: 'a', toId: 'b', typeId: 'rt-parent' }];
    expect(peopleOf(d).map((r) => r.item.id).sort()).toEqual(['a', 'b']);
  });

  it('uder fødsel/død som undersager giver levetid', () => {
    const d: TimelineDoc = {
      version: 1,
      name: 'liv',
      itemTypes: [
        { id: 'defaultPerson', name: 'Person', color: '#59a14f' },
        { id: 'defaultEvent', name: 'Begivenelse', color: '#4a90d9' },
      ],
      relationTypes: [{ id: 'rt-parent', name: 'Forælder', reverseName: 'Barn' }],
      items: [
        { id: 'P1', typeId: 'defaultPerson', label: 'Noa', span: {} },
        { id: 'E1', typeId: 'defaultEvent', label: 'Noas fødsel', span: { start: { y: -4004, precision: 'year' } }, parentId: 'P1' },
        { id: 'E2', typeId: 'defaultEvent', label: 'Noa dør', span: { start: { y: -3509, precision: 'year' } }, parentId: 'P1' },
      ],
      relations: [],
    };
    const [noa] = peopleOf(d);
    expect(lifespanText(noa)).toBe('f. 4005 f.Kr. – d. 3510 f.Kr.');
    expect(noa.children.map((c) => c.id)).toEqual(['E1', 'E2']); // undersager tæller ogsaa som børn/hændelser
  });

  it('Aeon-relationsformer: ægtefælle og fødested', () => {
    const d: TimelineDoc = {
      version: 1,
      name: 'aeon-agtig',
      itemTypes: [
        { id: 'defaultPerson', name: 'Person', color: '#59a14f' },
        { id: 'defaultLocation', name: 'Sted', color: '#d9a441' },
      ],
      relationTypes: [
        { id: 'rt-parent', name: 'Forælder', reverseName: 'Barn' },
        { id: 'aeon-spouseRef', name: 'Spouse', reverseName: 'Spouse' },
        { id: 'aeon-birthplaceRef', name: 'Birthplace', reverseName: 'Person' },
      ],
      items: [
        { id: 'P1', typeId: 'defaultPerson', label: 'Zerubbabel', span: {}, sourceIds: ['S1', 'S2'] },
        { id: 'P2', typeId: 'defaultPerson', label: 'Shealtiel', span: {} },
        { id: 'P3', typeId: 'defaultPerson', label: 'Maria', span: {} },
        { id: 'L1', typeId: 'defaultLocation', label: 'Gesjur', span: {} },
      ],
      relations: [
        { id: 'r1', fromId: 'P2', toId: 'P1', typeId: 'rt-parent' },
        { id: 'r2', fromId: 'P3', toId: 'P1', typeId: 'aeon-spouseRef' },
        { id: 'r3', fromId: 'P1', toId: 'L1', typeId: 'aeon-birthplaceRef' },
      ],
    };
    const rows = peopleOf(d);
    const zer = rows.find((r) => r.item.id === 'P1')!;
    expect(zer.parents.map((p) => p.id)).toEqual(['P2']);
    expect(zer.spouses.map((p) => p.id)).toEqual(['P3']);
    expect(zer.places.map((p) => p.label)).toEqual(['Gesjur']);
    expect(zer.cites).toBe(2);
    const stats = peopleStats(rows);
    expect(stats).toEqual({ dated: 0, families: 1, cited: 1, lonely: 0 });
    expect(sortPeople(rows, 'kilde')[0].item.id).toBe('P1');
    expect(sortPeople(rows, 'navn')[0].item.label).toBe('Maria');
    expect(sortPeople(rows, 'barn')[0].item.id).toBe('P2');
  });

  it('tomt dokument giver ingen personer', () => {
    expect(peopleOf(emptyDoc('tom'))).toEqual([]);
  });
});
