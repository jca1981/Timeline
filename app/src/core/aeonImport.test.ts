import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aeonToDV, importAeon, findAeonJson, aeonSourceKind, aeonReliability, idList, allowedList } from './aeonImport';
import { peopleOf, peopleStats } from './people';

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

  it('aeldre og nyere form for id-lister og property-valg', () => {
    expect(idList(['x', 'y'])).toEqual(['x', 'y']);
    expect(idList({ b: 1, a: 0, c: false })).toEqual(['a', 'b']); // 3.5: { id: raekkefoelge }
    const valg = {
      extremely: { id: 'extremely', label: 'Extremely', sortOrder: 0 },
      very: { id: 'very', label: 'Very', sortOrder: 1 },
      moderately: { id: 'moderately', label: 'Moderately', sortOrder: 2 },
    };
    expect(allowedList(valg).map((o) => o.id)).toEqual(['extremely', 'very', 'moderately']);
    expect(allowedList([{ id: 'a', label: 'A' }]).map((o) => o.id)).toEqual(['a']);
    expect(aeonReliability('very', { id: 'reliability', format: 'list', allowed: valg })).toBe(2);
  });

  it('poster med links/attachments som maps og kilder i 3.5-form', () => {
    const valg = {
      extremely: { id: 'extremely', label: 'Extremely', sortOrder: 0 },
      very: { id: 'very', label: 'Very', sortOrder: 1 },
      moderately: { id: 'moderately', label: 'Moderately', sortOrder: 2 },
    };
    const raw35: any = structuredClone(RAW15);
    raw35.core.definitions.references.byId.sourceRef = { id: 'sourceRef', label: 'Source', types: { kildeType: true } };
    raw35.core.definitions.properties = { byId: { reliability: { id: 'reliability', label: 'Reliability', format: 'list', allowed: valg } } };
    raw35.core.data.itemsById.A.links = { ATT1: 0 };
    raw35.core.data.itemsById.A.attachments = { ATT2: 1 };
    raw35.core.data.itemsById.S = { id: 'S', type: 'kildeType', label: 'Min kilde', propertyValues: { reliability: 'very' }, links: { ATT3: 0 } };
    raw35.core.data.itemDatesById.S = { startDate: { era: 1, year: 1, precision: -1 } };
    raw35.core.data.attachmentsById = {
      ATT1: { id: 'ATT1', path: 'https://eksempel.dk/artikel', label: 'artikel' },
      ATT2: { id: 'ATT2', path: 'aeonEmbedded://attachments/ATT2', label: 'foto.png' },
      ATT3: { id: 'ATT3', path: 'https://eksempel.dk/kilde', label: 'kilde' },
    };
    const { doc } = importAeon(wrapArchive(png, JSON.stringify(raw35), [{ id: 'IMGID12345678', filename: 'esra.png', offset: 0, size: png.length }]));
    expect(doc.items.find((i) => i.id === 'A')!.tags).toEqual(['Præst']);
    expect(doc.items.some((i) => i.id === 'S')).toBe(false); // kilde-element hoerer til biblioteket
    const kilder = doc.sources!;
    expect(kilder).toHaveLength(1);
    expect(kilder[0].title).toBe('Min kilde');
    expect(kilder[0].url).toBe('https://eksempel.dk/kilde');
    expect(kilder[0].reliability).toBe(2);
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

// ---- M29b: Aeons kilder (kilde-element + "Source"-relationer) ----
const SRC_RAW = {
  definitions: {
    types: {
      byId: {
        defaultEvent: { id: 'defaultEvent', label: 'Event', enabled: true },
        SOU: { id: 'SOU', label: 'Source', enabled: true, identifierPrefix: 'SOU' },
      },
    },
    references: {
      byId: {
        sourceRef: { id: 'sourceRef', label: 'Source', key: 'sourceRef', types: ['SOU'] },
        'SRC-CUSTOM': { id: 'SRC-CUSTOM', label: 'kilde', types: ['SOU'] },
        parentRef: { id: 'parentRef', label: 'Parent', inverseLabel: 'Child' },
      },
    },
    colors: { byId: {} },
    properties: {
      byId: {
        'PROP-REL': {
          id: 'PROP-REL', key: 'reliability', label: 'Reliability', format: 'list',
          allowed: [{ id: 'extremely', label: 'Extremely' }, { id: 'very', label: 'Very' }, { id: 'moderately', label: 'Moderately' }, { id: 'notVery', label: 'Not very' }, { id: 'poor', label: 'Poor' }],
        },
        'PROP-TYPE': {
          id: 'PROP-TYPE', key: 'sourceType', label: 'Source Type', format: 'list',
          allowed: [{ id: 'publishedDocument', label: 'Published' }, { id: 'secondarySource', label: 'Secondary' }],
        },
        notes: { id: 'notes', key: 'notes', label: 'Notes', format: 'multitext' },
      },
    },
  },
  data: {
    items: {
      byId: {
        E1: { id: 'E1', type: 'defaultEvent', label: 'Jesus dber for Pilatus', startDate: { era: 1, year: 33, month: 4, day: 3, precision: 2 }, links: ['ATT1'] },
        E2: { id: 'E2', type: 'defaultEvent', label: 'Uden kilde', startDate: { era: 1, year: 29, precision: 2 } },
        S1: {
          id: 'S1', type: 'SOU', label: 'JW.ORG', summary: 'Wachtturm-artikel', links: ['ATT1'],
          propertyValues: { 'PROP-TYPE': 'publishedDocument', 'PROP-REL': 80, notes: 'tilgengelig paa nettet' },
        },
        S2: { id: 'S2', type: 'SOU', label: 'Oscar - optegnelse', propertyValues: { 'PROP-TYPE': 'secondarySource' } },
        S3: { id: 'S3', type: 'SOU', label: 'Uden URL', propertyValues: { 'PROP-REL': 'poor' } },
      },
    },
    // nyere .aeon-filer gemmer relationer som array — importen skal kaede begge former
    relationships: [
      { id: 'RS1', subject: 'E1', reference: 'sourceRef', object: 'S1' },
      { id: 'RS2', subject: 'E1', reference: 'SRC-CUSTOM', object: 'S2' },
      { id: 'RS3', subject: 'S3', reference: 'sourceRef', object: 'E1' }, // vendt om i filen
      { id: 'RP', subject: 'E2', reference: 'parentRef', object: 'E1' },
    ],
    tags: {},
    attachments: {
      byId: {
        ATT1: { id: 'ATT1', label: 'INFO', path: 'https://www.jw.org/da/bibliotek/blade/g201309/' },
        ATT2: { id: 'ATT2', label: 'foto.jpg', path: 'aeonEmbedded://attachments/ATT2' },
      },
    },
  },
  fileVersion: 7,
};

describe('Aeon-kilder (M29b)', () => {
  const sbuf = wrapAeon(JSON.stringify(SRC_RAW));

  it('flytter kilde-elementer fra poster til kildebiblioteket', () => {
    const { doc, warnings } = importAeon(sbuf, 'Kilde-test');
    expect(doc.items.map((i) => i.id)).toEqual(['E1', 'E2']);
    expect((doc.sources ?? []).map((s) => s.id).sort()).toEqual(['S1', 'S2', 'S3']);
    expect(warnings.join(' ')).toContain('3 kilder importeret');
    // kilde-typer skal ikke fyldes op i type-listen i Ark
    expect(doc.itemTypes.map((t) => t.id)).toEqual(['defaultEvent']);
  });

  it('mapper kilde-relationer til citationer og undenser Source-relationstyper', () => {
    const { doc } = importAeon(sbuf, 'Kilde-test');
    const e1 = doc.items.find((i) => i.id === 'E1')!;
    expect(e1.sourceIds).toEqual(['S1', 'S2', 'S3']); // inkl. den relation der er gemt omvendt
    expect((doc.relations ?? []).map((r) => r.typeId)).toEqual(['rt-parent']);
    expect((doc.relationTypes ?? []).map((t) => t.name)).toEqual(['Forælder']);
  });

  it('laser URL, kildetype, medium, troværdighed og noter', () => {
    const { doc } = importAeon(sbuf, 'Kilde-test');
    const s1 = doc.sources!.find((s) => s.id === 'S1')!;
    expect(s1.url).toBe('https://www.jw.org/da/bibliotek/blade/g201309/');
    expect(s1.kind).toBe('primær');
    expect(s1.medium).toBe('Published');
    expect(s1.reliability).toBe(4); // 80 % → fire ud af fem
    expect(s1.notes).toContain('Wachtturm-artikel');
    expect(s1.notes).toContain('tilgengelig');
    const s2 = doc.sources!.find((s) => s.id === 'S2')!;
    expect(s2.kind).toBe('sekundær');
    expect(s2.url).toBeUndefined(); // aeonEmbedded-stier er filer, ikke web-laenker
    expect(doc.sources!.find((s) => s.id === 'S3')!.reliability).toBe(1); // listevalget "poor"
  });

  it('hjaelper-funktioner: sourceType- og reliability-formater', () => {
    expect(aeonSourceKind('publishedDocument')).toBe('primær');
    expect(aeonSourceKind('visualDocument')).toBe('primær');
    expect(aeonSourceKind('secondarySource')).toBe('sekundær');
    expect(aeonSourceKind('tertiarySource')).toBe('tertiær');
    expect(aeonSourceKind('')).toBeUndefined();
    const list = { id: 'reliability', key: 'reliability', format: 'list', allowed: [
      { id: 'extremely', label: 'Extremely' }, { id: 'very', label: 'Very' },
      { id: 'moderately', label: 'Moderately' }, { id: 'notVery', label: 'Not very' }, { id: 'poor', label: 'Poor' },
    ] };
    expect(aeonReliability('extremely', list)).toBe(5);
    expect(aeonReliability('moderately', list)).toBe(3);
    expect(aeonReliability('Poor', list)).toBe(1); // label i stedet for id, stor forbogstav
    expect(aeonReliability(2, list)).toBe(3); // index i listen
    expect(aeonReliability(80, { id: 'r', key: 'reliability', format: 'percentage' })).toBe(4);
    expect(aeonReliability(0.95, { id: 'r', key: 'reliability', format: 'percentage' })).toBe(5);
    expect(aeonReliability(0, { id: 'r', key: 'reliability', format: 'percentage' })).toBe(1);
    expect(aeonReliability(undefined, list)).toBeUndefined();
  });
});

// ---- committet fixture: JSON-blokken fra brugerens virkelige .aeon-fil (uden billeder) — kører i CI ----
// genskriv hvis den virkelige fil ændres: node tools/make-fixture.mjs "C:\path\til\Tidslinie-Historien Til nu.aeon"
const FIXTURE = fileURLToPath(new URL('../../testdata/aeon-real-fixture.json', import.meta.url));
const fixtureBuf = readFileSync(FIXTURE);
const FIXTURE_ARRAY = fixtureBuf.buffer.slice(fixtureBuf.byteOffset, fixtureBuf.byteOffset + fixtureBuf.byteLength) as ArrayBuffer;

describe('committet .aeon-fixture (M34 — format-drift)', () => {
  const { doc, warnings } = importAeon(FIXTURE_ARRAY, 'Tidslinje');

  it('alle 357 poster fra den virkelige fil overlever — intet droppet', () => {
    expect(doc.items.length).toBe(357);
    expect(warnings.filter((w) => w.includes('ukendt type'))).toEqual([]);
    expect(doc.itemTypes.length).toBe(9);
    // M32: datoer (også f.Kr.) skal overleve; 251 daterede, 150 f.Kr.
    expect(doc.items.filter((i) => i.span.start).length).toBe(251);
    expect(doc.items.filter((i) => (i.span.start?.y ?? 0) < 0).length).toBe(150);
  });

  it('relationer, kilder og citationer (M29b/M32)', () => {
    expect(doc.relations?.length).toBe(237);
    expect(doc.relations!.filter((r) => r.typeId === 'rt-parent').length).toBe(77);
    const jesus = doc.items.find((i) => i.label === 'Jesus');
    expect(doc.relations!.filter((r) => r.typeId === 'rt-parent' && r.toId === jesus?.id)
      .map((r) => doc.items.find((i) => i.id === r.fromId)?.label).sort()).toEqual(['Josef', 'Maria Jesus mor']);
    expect(doc.sources?.length).toBe(5);
    expect(doc.items.filter((i) => i.sourceIds?.length).length).toBe(38);
    expect(doc.items.some((i) => i.label === 'JW.ORG')).toBe(false);
  });

  it('person-overblik (M30)', () => {
    const rows = peopleOf(doc);
    expect(rows.length).toBe(89);
    expect(peopleStats(rows).families).toBe(56);
    expect(rows.find((r) => r.item.label === 'Zerubbabel')?.parents.map((p) => p.label)).toEqual(['Shealtiel']);
    expect(rows.find((r) => r.item.label === 'Maria Jesus mor')?.spouses.map((s) => s.label)).toEqual(['Josef']);
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
  // M29b: Aeons kilde-elementer bliver til kilder med citationer, ikke barpper
  expect((doc.sources ?? []).length).toBeGreaterThanOrEqual(5);
  expect(doc.items.filter((i) => i.sourceIds?.length).length).toBeGreaterThan(20);
  expect(doc.items.some((i) => i.label === 'JW.ORG')).toBe(false);
}, 30_000);

(REAL ? it : it.skip)('den virkelige fil giver person-overblik (M30)', () => {
  const buf = readFileSync(REAL!).buffer as ArrayBuffer;
  const { doc } = importAeon(buf, 'Tidslinje');
  const rows = peopleOf(doc);
  expect(rows.length).toBeGreaterThanOrEqual(50); // Aeons 87 "Person"-poster
  const zer = rows.find((r) => r.item.label === 'Zerubbabel');
  expect(zer?.parents.map((p) => p.label)).toEqual(['Shealtiel']);
  const maria = rows.find((r) => r.item.label === 'Maria Jesus mor');
  expect(maria?.spouses.map((s) => s.label)).toEqual(['Josef']);
  // de fleste personer har ingen dato — netop det hul fanen skal gøre synligt
  const stats = peopleStats(rows);
  expect(stats.dated).toBeLessThan(rows.length);
  expect(stats.families).toBeGreaterThan(10);
}, 30_000);
