import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aeonToDV, importAeon, findAeonJson } from './aeonImport';

// ---- synthetisk .aeon-fil: billede-støj + JSON + padding/footer ----
const RAW = {
  definitions: {
    types: {
      byId: {
        defaultEvent: { id: 'defaultEvent', label: 'Event', enabled: true },
        defaultPerson: { id: 'defaultPerson', label: 'Person', enabled: true },
        genericNode: { id: 'genericNode', label: 'Mindmap Node', enabled: true },
      },
    },
    references: {
      byId: {
        parentRef: { id: 'parentRef', label: 'Parent', inverseLabel: 'Child' },
        categoryRef: { id: 'categoryRef', label: 'Category' },
      },
    },
    colors: { byId: { C1: { id: 'C1', swatchColor: 'yellow' } } },
  },
  data: {
    items: {
      byId: {
        A: {
          id: 'A', type: 'defaultPerson', label: 'Esra', summary: 'skriveren',
          color: 'C1', ongoing: false, tags: ['T1'],
          startDate: { era: 0, year: 455, month: 7, day: 1, precision: 2 },
          duration: { years: 0, months: 0, weeks: 0, days: 0 },
        },
        B: {
          id: 'B', type: 'defaultEvent', label: 'Templet genopbygget',
          startDate: { era: 1, year: 515, month: 12, day: 1, precision: 2 },
          duration: { years: 4, months: 0, weeks: 0, days: 0 },
        },
        C: { id: 'C', type: 'defaultPerson', label: 'Uden dato', startDate: { era: 1, precision: -1 } },
        M: { id: 'M', type: 'genericNode', label: 'mindmap-node', startDate: { era: 1, year: 1, precision: -1 } },
      },
    },
    relationships: {
      byId: {
        R1: { id: 'R1', subject: 'B', reference: 'parentRef', object: 'A' }, // A er forælder til B
        R2: { id: 'R2', subject: 'A', reference: 'categoryRef', object: 'B' },
        R3: { id: 'R3', subject: 'A', reference: 'parentRef', object: 'M' }, // M sprunget over → relation droppes
      },
    },
    tags: { T1: 'Præst' },
  },
  fileVersion: 7,
};

function wrapAeon(json: string): ArrayBuffer {
  const head = new Uint8Array([...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ...Array(500).fill(0x42)]);
  const body = new TextEncoder().encode(json);
  const foot = new Uint8Array(64); // zero-padding + footer
  const out = new Uint8Array(head.length + body.length + foot.length);
  out.set(head, 0); out.set(body, head.length); out.set(foot, head.length + body.length);
  return out.buffer;
}

describe('aeonImport', () => {
  const buf = wrapAeon(JSON.stringify(RAW));

  it('finder JSON-blob i binær container', () => {
    const raw = findAeonJson(buf);
    expect(raw.fileVersion).toBe(7);
  });

  it('kaster på ikke-.aeon-data', () => {
    const junk = new TextEncoder().encode('bare en tekstfil').buffer;
    expect(() => findAeonJson(junk)).toThrow(/Ikke en .aeon-fil/);
  });

  it('mapper f.Kr. (era 0) → astronomisk årstal', () => {
    expect(aeonToDV({ era: 0, year: 455, month: 7, day: 1, precision: 2 })!.y).toBe(-454);
    expect(aeonToDV({ era: 1, year: 515, precision: 2 })!.y).toBe(515);
    expect(aeonToDV({ era: 1, precision: -1 })).toBeUndefined();
  });

  it('importerer poster, farver, tags, hierarki — og dropper mindmap-noder', () => {
    const { doc, warnings } = importAeon(buf, 'Test');
    expect(doc.name).toBe('Test');
    expect(doc.items.map((i) => i.label).sort()).toEqual(['Esra', 'Templet genopbygget', 'Uden dato']);
    const esra = doc.items.find((i) => i.id === 'A')!;
    expect(esra.span.start).toEqual({ y: -454, mo: 7, d: 1, precision: 'day' });
    expect(esra.color).toBe('yellow');
    expect(esra.tags).toEqual(['Præst']);
    expect(esra.notes).toBe('skriveren');
    const tempel = doc.items.find((i) => i.id === 'B')!;
    expect(tempel.span.duration).toEqual({ y: 4 });
    expect(tempel.span.end).toBeDefined(); // syncSpan har beregnet end
    expect(warnings.some((w) => /uden dato/.test(w))).toBe(true);
  });

  it('forælder-relation vendt om (object=far) og generiske relationer bevaret', () => {
    const { doc } = importAeon(buf);
    const rels = doc.relations!;
    const parent = rels.find((r) => r.typeId === 'rt-parent')!;
    expect(parent.fromId).toBe('A'); // forælder
    expect(parent.toId).toBe('B');   // barn
    const cat = rels.find((r) => r.typeId === 'aeon-categoryRef')!;
    expect(cat.fromId).toBe('A');
    expect(cat.toId).toBe('B');
    expect(rels).toHaveLength(2); // M-relation droppet (post sprunget over)
    expect(doc.relationTypes!.some((t) => t.id === 'rt-parent' && t.name === 'Forælder')).toBe(true);
    expect(doc.relationTypes!.some((t) => t.name === 'Category')).toBe(true);
  });

  it('springer over relationer til ikke-eksisterende poster', () => {
    const bad = wrapAeon(JSON.stringify({
      ...RAW,
      data: { ...RAW.data, relationships: { byId: { R9: { id: 'R9', subject: 'A', reference: 'parentRef', object: 'FANTOM' } } } },
    }));
    const { doc } = importAeon(bad);
    expect(doc.relations).toHaveLength(0);
  });
});

// ---- ægte fil (kun lokalt — hopper automatisk over i CI) ----
const REAL = fileURLToPath(new URL('../../../Import/Tidslinie-Historien Til nu.aeon', import.meta.url));
const have = existsSync(REAL);
(have ? it : it.skip)('importerer den virkelige .aeon-fil', () => {
  const buf = readFileSync(REAL).buffer as ArrayBuffer;
  const { doc } = importAeon(buf, 'Tidslinje');
  expect(doc.items.length).toBeGreaterThan(200);
  const jesus = doc.items.find((i) => i.label === 'Jesus');
  expect(jesus).toBeDefined();
  const par = (doc.relations ?? []).filter((r) => r.typeId === 'rt-parent' && r.toId === jesus!.id);
  expect(par.map((r) => doc.items.find((i) => i.id === r.fromId)?.label).sort()).toEqual(['Josef', 'Maria Jesus mor']);
  // BC-datoer skal være negative årstal
  const bc = doc.items.filter((i) => (i.span.start?.y ?? 0) < 0);
  expect(bc.length).toBeGreaterThan(50);
}, 30_000);
