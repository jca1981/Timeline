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

// ---- Aeon 3.15+ (fileVersion 15): core-wrap, dater adskilt, tags som map ----
const RAW15 = {
  fileVersion: 15,
  core: {
    definitions: {
      types: {
        byId: {
          defaultEvent: { id: 'defaultEvent', label: 'Event', enabled: true },
          defaultPerson: { id: 'defaultPerson', label: 'Person', enabled: true },
          genericNode: { id: 'genericNode', label: 'Mindmap Node', enabled: true },
        },
      },
      references: { byId: { parentRef: { id: 'parentRef', label: 'Parent', inverseLabel: 'Child' }, categoryRef: { id: 'categoryRef', label: 'Category' } } },
      colors: { byId: { C1: { id: 'C1', swatchColor: 'yellow' } } },
    },
    data: {
      itemsById: {
        A: { id: 'A', type: 'defaultPerson', label: 'Esra', color: 'C1', tags: { T1: 0 }, image: 'IMGID12345678' },
        B: { id: 'B', type: 'defaultEvent', label: 'Templet genopbygget' },
        C: { id: 'C', type: 'defaultPerson', label: 'Uden dato' },
        M: { id: 'M', type: 'genericNode', label: 'mindmap-node' },
      },
      itemDatesById: {
        A: { ongoing: false, preferredStartDate: { era: 0, year: 455, month: 7, day: 1, precision: 2 }, preferredDuration: { years: 0, months: 0, weeks: 0, days: 0 }, startDate: { era: 0, year: 455, month: 7, day: 1, precision: 2 }, duration: { years: 0, months: 0, weeks: 0, days: 0 } },
        B: { startDate: { era: 1, year: 515, month: 12, day: 1, precision: 2 }, duration: { years: 4, months: 0, weeks: 0, days: 0 } },
        C: { startDate: { era: 1, precision: -1 } },
        M: { startDate: { era: 1, year: 1, precision: -1 } },
      },
      superAndChildOrderById: { A: { childOrder: {}, super: null }, B: { childOrder: {}, super: 'A' } },
      relationshipsById: {
        R1: { id: 'R1', subject: 'B', reference: 'parentRef', object: 'A' },
        R2: { id: 'R2', subject: 'A', reference: 'categoryRef', object: 'B' },
        R3: { id: 'R3', subject: 'A', reference: 'parentRef', object: 'M' },
      },
      tags: { T1: 'Præst' },
    },
  },
};

/** Byg en "app.timeline.indexedArchive": [header][billede-blobs][footer-index][JSON]. Offsets er header-relative. */
function wrapArchive(png: Uint8Array, json: string, records: { id: string; filename: string; offset: number; size: number }[]): ArrayBuffer {
  const head = new TextEncoder().encode('app.timeline.indexedArchive');
  const idx: number[] = [];
  for (const r of records) {
    const idB = [...new TextEncoder().encode(r.id)], fnB = [...new TextEncoder().encode(r.filename)];
    const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    idx.push(...u32(idB.length), ...u32(fnB.length), ...idB, ...fnB, ...u32(r.offset), ...u32(0), ...u32(r.size), ...u32(0));
  }
  const body = new TextEncoder().encode(json);
  const foot = new Uint8Array(64);
  const parts = [head, png, new Uint8Array(idx), body, foot];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out.buffer;
}

describe('aeonImport (fileVersion 15)', () => {
  // gyldig PNG-signatur + lidt data, sata stoerre end magiens 4 bytes
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(300).fill(0x42)]);
  const buf = wrapArchive(png, JSON.stringify(RAW15), [
    { id: 'IMGID12345678', filename: 'esra.png', offset: 0, size: png.length },
  ]);

  it('finder JSON bak core-wrappen', () => {
    expect(findAeonJson(buf).fileVersion).toBe(15);
  });

  it('mapper dater fra itemDatesById (ogsaa f.Kr.)', () => {
    const { doc } = importAeon(buf);
    const a = doc.items.find((i) => i.id === 'A')!;
    expect(a.span.start).toEqual({ y: -454, mo: 7, d: 1, precision: 'day' });
    const b = doc.items.find((i) => i.id === 'B')!;
    expect(b.span.start).toEqual({ y: 515, mo: 12, d: 1, precision: 'day' });
    expect(b.span.duration).toEqual({ y: 4 });
    expect(doc.items.find((i) => i.id === 'C')!.span.start).toBeUndefined();
  });

  it('laser hierarchy fra superAndChildOrderById og tags som map', () => {
    const { doc } = importAeon(buf);
    expect(doc.items.find((i) => i.id === 'B')!.parentId).toBe('A');
    expect(doc.items.find((i) => i.id === 'A')!.tags).toEqual(['Præst']);
    expect(doc.items.some((i) => i.id === 'M')).toBe(false);
    const rels = doc.relations!;
    expect(rels.find((r) => r.typeId === 'rt-parent')!.fromId).toBe('A');
    expect(rels).toHaveLength(2);
  });

  it('laser billeder ud af indexed archive (header-relative offsets, base58-id)', () => {
    const { doc, images } = importAeon(buf);
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe('IMGID12345678');
    expect(images[0].mimeType).toBe('image/png');
    expect(images[0].blob.byteLength).toBe(png.length);
    expect(doc.items.find((i) => i.id === 'A')!.imageId).toBe('IMGID12345678');
  });
});

// ---- ægte fil (kun lokalt — hopper automatisk over i CI) ----
const REAL_CANDIDATES = [
  fileURLToPath(new URL('../../../Import/Tidslinie-Historien Til nu.aeon', import.meta.url)),
  'C:/Users/jensa/OneDrive/Documents/Tidslinie-Historien Til nu.aeon',
];
const REAL = REAL_CANDIDATES.find((p) => existsSync(p));
(REAL ? it : it.skip)('importerer den virkelige .aeon-fil', () => {
  const buf = readFileSync(REAL!).buffer as ArrayBuffer;
  const { doc, images } = importAeon(buf, 'Tidslinje');
  expect(doc.items.length).toBeGreaterThan(200);
  expect(doc.items.filter((i) => i.span.start).length).toBeGreaterThan(200);
  expect(images.length).toBeGreaterThan(10);
  const jesus = doc.items.find((i) => i.label === 'Jesus');
  expect(jesus).toBeDefined();
  const par = (doc.relations ?? []).filter((r) => r.typeId === 'rt-parent' && r.toId === jesus!.id);
  expect(par.map((r) => doc.items.find((i) => i.id === r.fromId)?.label).sort()).toEqual(['Josef', 'Maria Jesus mor']);
  // BC-datoer skal være negative årstal
  const bc = doc.items.filter((i) => (i.span.start?.y ?? 0) < 0);
  expect(bc.length).toBeGreaterThan(50);
}, 30_000);
