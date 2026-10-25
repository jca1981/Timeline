// **** Skabeloner: bibel-kronologi, bibelske personer (M4) ****
import { emptyDoc, newId, type Item, type ItemType, type TimelineDoc } from './doc';
import { syncSpan } from '../core/sync';
import type { Span } from '../core/types';

export interface Template {
  name: string;
  build: () => TimelineDoc;
}

// ---- Bibel-kronologi ----
const BIBLE_KRONOLOGI_TYPES: ItemType[] = [
  { id: 't-event', name: 'Begivenelse', color: '#4a90d9' },
  { id: 't-person', name: 'Person', color: '#59a14f' },
  { id: 't-nation', name: 'Rige / Folk', color: '#d9a441' },
  { id: 't-prophecy', name: 'Profeti', color: '#a865c8' },
  { id: 't-dynasty', name: 'Dynasti / Kongerække', color: '#c0392b' },
  { id: 't-place', name: 'Sted', color: '#27ae60' },
];

function bk(): TimelineDoc {
  const doc = emptyDoc('Bibel-kronologi');
  doc.itemTypes = BIBLE_KRONOLOGI_TYPES;
  const mk = (typeId: string, label: string, span: Span, extra?: Partial<Item>): Item =>
    ({ id: newId(), typeId, label, span, ...extra });

  doc.items = [
    // Skabelse / ældste tid
    mk('t-event', 'Skabelsen', { start: { y: -4004, precision: 'year' }, uncertain: { latestStart: { y: -4000, precision: 'year' } } }, { verseRefs: [{ bookSlug: 'Genesis', ch: 1 }], tags: ['skabelse', 'start'] }),
    mk('t-event', 'Syndefloden', { start: { y: -2370, precision: 'year' }, duration: { d: 150 } }, { verseRefs: [{ bookSlug: 'Genesis', ch: 7 }], tags: ['dom', 'noa'] }),
    mk('t-event', 'Tårnet i Babel', { start: { y: -2242, precision: 'year' } }, { verseRefs: [{ bookSlug: 'Genesis', ch: 11 }], tags: ['forvirring'] }),

    // Patriarker
    mk('t-person', 'Abraham', { start: { y: -1921, precision: 'year' }, end: { y: -1738, precision: 'year' } }, { verseRefs: [{ bookSlug: 'Genesis', ch: 12 }], tags: ['pagt', 'tro'] }),
    mk('t-person', 'Isak', { start: { y: -1896, precision: 'year' }, end: { y: -1716, precision: 'year' } }, { tags: ['pagt'] }),
    mk('t-person', 'Jakob/Israel', { start: { y: -1837, precision: 'year' }, end: { y: -1689, precision: 'year' } }, { tags: ['pagt', 'stammer'] }),

    // Udgang & landgivning
    mk('t-event', 'Udgangen fra Egypten', { start: { y: -1513, precision: 'year' } }, { verseRefs: [{ bookSlug: '2 Mosebog', ch: 12 }], tags: ['frihed', 'pagt'] }),
    mk('t-event', 'Landgivningen', { start: { y: -1473, precision: 'year' }, duration: { y: 7 } }, { tags: ['lov'] }),

    // Kongeriget
    mk('t-dynasty', 'Davids dynasti', { start: { y: -1077, precision: 'year' }, end: { y: -586, precision: 'year' } }, { tags: ['krone', 'messias'] }),
    mk('t-person', 'David', { start: { y: -1077, precision: 'year' }, end: { y: -1017, precision: 'year' } }, { verseRefs: [{ bookSlug: '2 Samuel', ch: 5 }], tags: ['krone', 'psalmer'] }),
    mk('t-person', 'Salomo', { start: { y: -1016, precision: 'year' }, end: { y: -937, precision: 'year' } }, { tags: ['tempel', 'visdom'] }),
    mk('t-event', 'Tempelbygning færdig', { start: { y: -1026, precision: 'year' } }, { verseRefs: [{ bookSlug: '1 Kongebog', ch: 6 }], tags: ['tempel'] }),
    mk('t-nation', 'Nordriget (Israel)', { start: { y: -930, precision: 'year' }, end: { y: -740, precision: 'year' } }, { tags: ['splittelse'] }),
    mk('t-nation', 'Sydriget (Juda)', { start: { y: -930, precision: 'year' }, end: { y: -607, precision: 'year' } }, { tags: ['splittelse', 'krone'] }),

    // Profetier & opfyldelser
    mk('t-prophecy', 'Profeti: 70 års eksil', { start: { y: -609, precision: 'year' }, end: { y: -539, precision: 'year' } }, { verseRefs: [{ bookSlug: 'Jeremias', ch: 25, vs: 11 }], tags: ['profeti', 'eksil'] }),
    mk('t-event', 'Babylonsk eksil (70 år)', { start: { y: -607, precision: 'year' }, duration: { y: 70 } }, { tags: ['eksil', 'opfyldelse'] }),
    mk('t-prophecy', 'Profeti: Messias som lidende tjener', { start: { y: -700, precision: 'year' } }, { verseRefs: [{ bookSlug: 'Jesaja', ch: 53 }], tags: ['profeti', 'messias'] }),

    // Eksil & tilbagevenden
    mk('t-event', 'Jerusalems fald', { start: { y: -607, precision: 'year' } }, { verseRefs: [{ bookSlug: '2 Kongebog', ch: 25 }], tags: ['dom'] }),
    mk('t-event', 'Tilbagevenden', { start: { y: -537, precision: 'year' } }, { verseRefs: [{ bookSlug: 'Ezra', ch: 1 }], tags: ['genoprettelse', 'opfyldelse'] }),

    // Nytestamente
    mk('t-person', 'Jesus af Nazaret', { start: { y: -3, precision: 'year' }, duration: { y: 33 } }, { verseRefs: [{ bookSlug: 'Matthæus', ch: 1 }], tags: ['messias', 'opfyldelse'] }),
    mk('t-event', 'Pinsedagen (menigheden)', { start: { y: 33, mo: 5, d: 11, precision: 'day' } }, { verseRefs: [{ bookSlug: 'Gerningsbegivenelserne', ch: 2 }], tags: ['helligånd'] }),
    mk('t-nation', 'Romerveldet', { start: { y: -27, precision: 'year' }, end: { y: 476, precision: 'year' } }, { tags: ['rige'] }),
  ];

  // Set parentIds for hierarchy
  doc.items[9]!.parentId = doc.items[8]!.id;  // David → Davids dynasti
  doc.items[10]!.parentId = doc.items[8]!.id; // Salomo → Davids dynasti
  doc.items[11]!.parentId = doc.items[8]!.id; // Tempelbygning → Davids dynasti
  doc.items[12]!.parentId = doc.items[8]!.id; // Nordriget → Davids dynasti
  doc.items[13]!.parentId = doc.items[8]!.id; // Sydriget → Davids dynasti
  doc.items[16]!.parentId = doc.items[14]!.id; // Eksil → Profeti 70 år
  doc.items[19]!.parentId = doc.items[16]!.id; // Jesus → Messias-profeti

  doc.relations = [
    { id: newId(), fromId: doc.items[3].id, toId: doc.items[4].id, typeId: 'rt-parent' }, // Abraham → Isak
    { id: newId(), fromId: doc.items[4].id, toId: doc.items[5].id, typeId: 'rt-parent' }, // Isak → Jakob
    // Profeti → Opfyldelse (buer)
    { id: newId(), fromId: doc.items[14].id, toId: doc.items[16].id, typeId: 'rt-fulfillment', note: 'Jeremias 25:11 opfyldt' },
    { id: newId(), fromId: doc.items[16].id, toId: doc.items[19].id, typeId: 'rt-fulfillment', note: 'Jesaja 53 opfyldt i Jesus' },
    { id: newId(), fromId: doc.items[14].id, toId: doc.items[18].id, typeId: 'rt-fulfillment', note: '70 år → tilbagevenden' },
  ];

  // M28: kilder som førsteklasses data — oversættelsen er primærkilde, tavlen i
  // studiebibelen er sekundær (kronologien står ikke i teksten)
  doc.sources = [
    { id: 'src-nwt', title: 'Bibelen — Ny Verden-oversættelsen', url: 'https://www.jw.org/da/bibel/nwt/', notes: 'primærkilde: selve verset', kind: 'primær', reliability: 5, checkedAt: '2026-10-25' },
    { id: 'src-studietavle', title: 'Studiebibelen — kronologitavlen', locator: 'kongelisten', url: 'https://www.jw.org/da/bibel/henvisninger/', notes: 'sekundærkilde: datoer beregnet ud fra teksten', kind: 'sekundær', reliability: 4, checkedAt: '2026-10-25' },
  ];
  for (const it of doc.items) {
    const ids: string[] = [];
    if (it.verseRefs?.length) ids.push('src-nwt');
    if (it.span.uncertain) ids.push('src-studietavle');
    if (ids.length) it.sourceIds = ids;
  }

  doc.items = doc.items.map((it) => ({ ...it, span: syncSpan(it.span).span ?? it.span }));
  return doc;
}

// ---- Bibelske personer (slægtstræ-fokus) ----
const BIBLICAL_PERSONS_TYPES: ItemType[] = [
  { id: 't-person', name: 'Person', color: '#59a14f' },
  { id: 't-event', name: 'Begivenelse', color: '#4a90d9' },
  { id: 't-place', name: 'Sted', color: '#27ae60' },
];

function bp(): TimelineDoc {
  const doc = emptyDoc('Bibelske personer (slægt)');
  doc.itemTypes = BIBLICAL_PERSONS_TYPES;
  const mk = (typeId: string, label: string, span: Span, extra?: Partial<Item>): Item =>
    ({ id: newId(), typeId, label, span, ...extra });

  // Jesus' slægtstræ (Matt 1)
  doc.items = [
    mk('t-person', 'Abraham', { start: { y: -1921, precision: 'year' }, end: { y: -1738, precision: 'year' } }, { tags: ['fædre', 'pagt'] }),
    mk('t-person', 'Isak', { start: { y: -1896, precision: 'year' }, end: { y: -1716, precision: 'year' } }, { tags: ['fædre', 'pagt'] }),
    mk('t-person', 'Jakob', { start: { y: -1837, precision: 'year' }, end: { y: -1689, precision: 'year' } }, { tags: ['fædre', 'stammer'] }),
    mk('t-person', 'Juda', { start: { y: -1753, precision: 'year' }, end: { y: -1625, precision: 'year' } }, { tags: ['stamme'] }),
    mk('t-person', 'David', { start: { y: -1077, precision: 'year' }, end: { y: -1017, precision: 'year' } }, { tags: ['krone', 'messias-linje'] }),
    mk('t-person', 'Salomo', { start: { y: -1016, precision: 'year' }, end: { y: -937, precision: 'year' } }, { tags: ['krone', 'tempel'] }),
    mk('t-person', 'Josjijkju', { start: { y: -659, precision: 'year' }, end: { y: -609, precision: 'year' } }, { tags: ['krone'] }),
    mk('t-person', 'Josef (Jesus’ pleje­far)', { start: { y: -20, precision: 'year' }, end: { y: 30, precision: 'year' } }, { tags: ['familie'] }),
    mk('t-person', 'Maria', { start: { y: -20, precision: 'year' }, end: { y: 40, precision: 'year' } }, { tags: ['familie'] }),
    mk('t-person', 'Jesus af Nazaret', { start: { y: -3, precision: 'year' }, duration: { y: 33 } }, { verseRefs: [{ bookSlug: 'Matthæus', ch: 1, vs: 16 }], tags: ['messias', 'opfyllgelse'] }),
  ];

  // parentOf relations (far → barn)
  const chain = [0, 1, 2, 3]; // Abraham→Isak→Jakob→Juda
  doc.relations = [];
  for (let i = 0; i < chain.length - 1; i++) {
    doc.relations.push({ id: newId(), fromId: doc.items[chain[i]].id, toId: doc.items[chain[i + 1]].id, typeId: 'rt-parent' });
  }
  // David → Salomo
  doc.relations.push({ id: newId(), fromId: doc.items[4].id, toId: doc.items[5].id, typeId: 'rt-parent' });
  // Juda→...→David (fortl. led for demo)
  doc.relations.push({ id: newId(), fromId: doc.items[3].id, toId: doc.items[4].id, typeId: 'rt-parent', note: 'several gen. (Matt 1)' });
  // Josjijkju → Josef
  doc.relations.push({ id: newId(), fromId: doc.items[6].id, toId: doc.items[7].id, typeId: 'rt-parent' });
  // Maria & Josef → Jesus
  doc.relations.push({ id: newId(), fromId: doc.items[8].id, toId: doc.items[9].id, typeId: 'rt-parent' });
  doc.relations.push({ id: newId(), fromId: doc.items[7].id, toId: doc.items[9].id, typeId: 'rt-parent', note: 'plejefar' });

  // parentId hierarchy for subway/tree grouping
  doc.items[1]!.parentId = doc.items[0]!.id; // Isak ← Abraham
  doc.items[2]!.parentId = doc.items[1]!.id; // Jakob ← Isak
  doc.items[3]!.parentId = doc.items[2]!.id; // Juda ← Jakob
  doc.items[4]!.parentId = doc.items[3]!.id; // David ← Juda
  doc.items[5]!.parentId = doc.items[4]!.id; // Salomo ← David
  doc.items[6]!.parentId = doc.items[5]!.id; // Josjijkju ← Salomo
  doc.items[7]!.parentId = doc.items[6]!.id; // Josef ← Josjijkju
  doc.items[9]!.parentId = doc.items[7]!.id; // Jesus ← Josef

  // Profeti→opfyldelse buer (Abrahams pagt → Jesus)
  doc.relations.push({ id: newId(), fromId: doc.items[0].id, toId: doc.items[9].id, typeId: 'rt-fulfillment', note: 'Pagten opfyldt i Messias' });

  doc.items = doc.items.map((it) => ({ ...it, span: syncSpan(it.span).span ?? it.span }));
  return doc;
}

export const TEMPLATES: Template[] = [
  { name: 'Bibel-kronologi', build: bk },
  { name: 'Bibelske personer (slægt)', build: bp },
];
