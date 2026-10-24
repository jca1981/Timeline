// **** Dokument-modellen (lettet M1-udgave af DESIGN.md's TimelineDoc) ****
import type { DateStyle, Span } from '../core/types';
import { syncSpan } from '../core/sync';

export interface ItemType {
  id: string;
  name: string;
  color: string; // normal farve; light variant udledes i UI
}

export interface Item {
  id: string;
  typeId: string;
  label: string;
  notes?: string;
  color?: string; // per-item override
  tags?: string[];
  parentId?: string;
  span: Span;
  dateStyle?: DateStyle; // relativ stil pr. item (uger/dage fra zero-date)
  verseRefs?: VerseRef[]; // bibelvers-links (deep links til jw.org + valgfrit citat)
  imageId?: string; // reference til billed-butik (IndexedDB images store)
}

/** Relationstype med navn i begge retninger (Aeon-mønster). */
export interface RelationType {
  id: string;
  name: string; // from → to, fx "Forælder"
  reverseName: string; // to → from, fx "Barn"
}

/** Typet many-to-many-relation mellem to poster. Slægt = relation, ikke specialkode. */
export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  typeId: string;
  note?: string; // fx "via Mattæus' slægtstavle"
}

/** Bibelvers-reference; tekst hentes IKKE (SPA+WAF) — deep link + manuelt citat. */
export interface VerseRef {
  bookSlug: string;
  ch: number;
  vs?: number;
  vsEnd?: number;
  quote?: string;
}

/** Dependency: blocker → blocked, med type (FS/FF/SS/SF). */
export type DepKind = 'FS' | 'FF' | 'SS' | 'SF';

export interface Dependency {
  id: string;
  blockerId: string;
  blockedId: string;
  kind: DepKind; // FS = Finish-to-Start (blocker slut → blocked start)
}

/** Filter for at indsnævre哪些 posters visning. */
export interface Filter {
  match: 'all' | 'any';
  types?: string[];   // itemTypeId[]
  tags?: string[];
  dateRange?: { from?: number; to?: number }; // JDN integers
  text?: string;       // fuzzy-label/notes-søgning
}

export interface TimelineDoc {
  version: 1;
  name: string;
  itemTypes: ItemType[];
  relationTypes?: RelationType[]; // M3 (valgfri for baglænes-kompatibilitet)
  items: Item[];
  relations?: Relation[];
  dependencies?: Dependency[];    // M4
  savedFilters?: Record<string, Filter>; // M4
}

export const DEFAULT_TYPES: ItemType[] = [
  { id: 't-event', name: 'Begivenelse', color: '#4a90d9' },
  { id: 't-person', name: 'Person', color: '#59a14f' },
  { id: 't-nation', name: 'Rige / Folk', color: '#d9a441' },
  { id: 't-prophecy', name: 'Profeti', color: '#a865c8' },
];

export const DEFAULT_RELATION_TYPES: RelationType[] = [
  { id: 'rt-parent', name: 'Forælder', reverseName: 'Barn' },
  { id: 'rt-fulfillment', name: 'Opfyldt af', reverseName: 'Opfylder' }, // profeti → begivenelse
  { id: 'rt-contemporary', name: 'Samtidig med', reverseName: 'Samtidig med' },
];

export function emptyDoc(name = 'Min tidslinje'): TimelineDoc {
  return { version: 1, name, itemTypes: DEFAULT_TYPES, relationTypes: DEFAULT_RELATION_TYPES, items: [], relations: [] };
}

/** Eksempel-indhold der demonstrerer alt motoren kan (bruges til demo + manuel røgtest). */
export function demoDoc(): TimelineDoc {
  const doc = emptyDoc('Bibel-kronologi (demo)');
  const mk = (id: string, typeId: string, label: string, span: Span, extra?: Partial<Item>): Item => ({ id, typeId, label, span, ...extra });
  doc.items = [
    mk('i0', 't-person', 'Maria (Jesus’ mor)', { start: { y: -20, precision: 'year' }, uncertain: { latestStart: { y: -15, precision: 'year' } }, end: { y: 40, precision: 'year' } }),
    mk('i1', 't-person', 'Jesus af Nazaret', { start: { y: -3, precision: 'year' }, duration: { y: 33 } }, { verseRefs: [{ bookSlug: 'Matthæus', ch: 2, vs: 1, vsEnd: 12, quote: '… vise mænd kom fra Øst til Jerusalem' }] }),
    mk('i2', 't-event', 'Barnemord i Betlehem', { start: { y: -3, precision: 'year' }, uncertain: { latestStart: Y0(-2) } }, { verseRefs: [{ bookSlug: 'Matthæus', ch: 2, vs: 16 }] }),
    mk('i3', 't-event', 'Tempelrenselser', { start: { y: 29, mo: 4, d: 3, precision: 'day' }, duration: { d: 1 } }, { verseRefs: [{ bookSlug: 'Matthæus', ch: 21, vs: 12, vsEnd: 13 }] }),
    mk('i4', 't-nation', 'Romerveldet (kejsertid)', { start: { y: -27, precision: 'year' }, end: { y: 476, precision: 'year' } }),
    mk('i5', 't-prophecy', 'Daniel 9:70 uger', { start: { y: -454, precision: 'year' }, duration: { y: 483 }, uncertain: { earliestEnd: { y: 26, precision: 'year' } } }, { verseRefs: [{ bookSlug: 'daniel', ch: 9, vs: 24, vsEnd: 27 }] }),
    mk('i6', 't-event', 'Mine fortsatte studier', { start: { y: 2026, mo: 10, precision: 'month' }, ongoing: true }),
  ];
  doc.relations = [
    { id: 'r1', fromId: 'i0', toId: 'i1', typeId: 'rt-parent' },
    { id: 'r2', fromId: 'i5', toId: 'i1', typeId: 'rt-fulfillment', note: 'profeti → opfyldelse' },
    { id: 'r3', fromId: 'i4', toId: 'i1', typeId: 'rt-contemporary' },
  ];
  // sync alle spans (end/duration beregnes)
  doc.items = doc.items.map((it) => ({ ...it, span: syncSpan(it.span).span ?? it.span }));
  return doc;
}

function Y0(y: number) {
  return { y, precision: 'year' as const };
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
