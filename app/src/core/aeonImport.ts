// **** Import af .aeon-filer (Aeon Timeline 3) ****
// Filformatet (reverse-engineeret, filVersion 7): [billede-blob: PNG/JFIF one-after-another]
// + rå JSON-document starting med {"definitions":...] + zero-padding + binær footer med index.
// Vi finder JSON-blobben, parser den og mapper til vores TimelineDoc.
// Billeder extraheres fra preamble via image-index (idLen/fnameLen/uuid/filename/offset/8+8 records).

import { addDuration } from './jdn';
import { syncSpan } from './sync';
import type { DateValue, Duration, Span } from './types';
import type { Item, Relation, RelationType, TimelineDoc } from '../model/doc';

export interface AeonImage { id: string; blob: ArrayBuffer; mimeType: string; filename?: string; }

// ---- Aeon-rå typer (kun det vi bruger) ----
interface AeonDate {
  era?: number; // 0 = f.Kr. (år tal opfattet positivt), 1 = e.Kr.
  year?: number;
  month?: number; day?: number; hour?: number; minute?: number; second?: number;
  precision: number; // -1 = ingen dato, 0=år, 1=måned, ≥2=dag, ≥8=time
}
interface AeonDuration {
  years?: number; months?: number; weeks?: number; days?: number;
  hours?: number; minutes?: number; seconds?: number;
}
interface AeonItem {
  id: string; type: string; label: string; summary?: string;
  color?: string; super?: string | null; ongoing?: boolean;
  startDate?: AeonDate | null; duration?: AeonDuration | null;
  latestStartDate?: AeonDate | null; durationToEarliestEnd?: AeonDuration | null;
  tags?: string[]; image?: string; attachments?: string[];
}
interface AeonRaw {
  definitions: {
    types: { byId: Record<string, { id: string; label: string; enabled?: boolean }> };
    references: { byId: Record<string, { id: string; label?: string; inverseLabel?: string }> };
    colors: { byId: Record<string, { id: string; swatchColor?: string }> };
  };
  data: {
    items: { byId: Record<string, AeonItem> };
    relationships?: { byId: Record<string, { id: string; subject: string; reference: string; object: string }> };
    tags?: Record<string, string>;
  };
  fileVersion?: number;
}

// ---- binær helpersøgning ----
function indexOfBytes(hay: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
const utf8Decoder = new TextDecoder('utf-8');

/**
 * Klammeparring fra `start` (som praeciser at vaere en `{`). Ignorerer strenger og escapede teikn.
 * UTF-8's fortsaettelsesbytes er altid >= 0x80 og kan derfor ikke forveksles med { } " \
 * Returnerer index EFTER den lukkende } (eller -1 hvis ufuldstaendigt).
 */
function matchJsonEnd(bytes: Uint8Array, start: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < bytes.length; i++) {
    const c = bytes[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Normalise'r forskellen pa Aeon's dokumentformer:
 *  - fileVersion 7 (flad):     { definitions, data: { items: { byId }, relationships: { byId }, tags } }
 *  - fileVersion 15 (nyere):   { fileVersion, core: { definitions, data: { itemsById, itemDatesById, relationshipsById, superAndChildOrderById, tags } } }
 * Alt mapper til den flade form, resten af importen kan kaede til.
 */
export function normalizeAeonDoc(j: any): AeonDoc {
  if (j?.definitions?.types?.byId && j?.data?.items?.byId) return j as AeonDoc;
  const core = j?.core ?? j;
  const data = core?.data ?? {};
  const itemsById: Record<string, any> | undefined = data.itemsById ?? data.items?.byId;
  if (!itemsById) return j as AeonDoc;
  const dates: Record<string, any> = data.itemDatesById ?? {};
  const hierarchy: Record<string, any> = data.superAndChildOrderById ?? {};
  const items: Record<string, AeonItem> = {};
  for (const [id, raw] of Object.entries(itemsById)) {
    const d = dates[id] ?? {};
    const tags = raw.tags;
    items[id] = {
      ...raw,
      super: raw.super ?? hierarchy[id]?.super ?? null,
      // nyere form opbevarer tags som { tagId: raekkefoelge } i stedet for en array af id'er
      tags: Array.isArray(tags) ? tags : Object.keys(tags ?? {}),
      // datoer ligger adskilt i itemDatesById (startDate er den viste vaerdi, preferred* er brugers valg)
      startDate: d.startDate ?? d.preferredStartDate ?? null,
      duration: d.duration ?? d.preferredDuration ?? null,
      ongoing: d.ongoing === true || raw.ongoing === true,
      latestStartDate: d.latestStartDate ?? null,
      durationToEarliestEnd: d.durationToEarliestEnd ?? null,
    } as AeonItem;
  }
  const defs = core.definitions ?? {};
  return {
    fileVersion: j?.fileVersion,
    definitions: {
      types: { byId: defs.types?.byId ?? {} },
      references: { byId: defs.references?.byId ?? {} },
      colors: { byId: defs.colors?.byId ?? {} },
    },
    data: {
      items: { byId: items },
      relationships: data.relationshipsById ? { byId: data.relationshipsById } : data.relationships,
      tags: data.tags,
    },
  } as AeonDoc;
}

type AeonDoc = AeonRaw;

export interface LocatedAeonJson { doc: AeonDoc; jsonStart: number; }

/** Find, parse og normalise'r Aeon's JSON-blob i en .aeon-fil. Returnerer ogsa start-indeks (bruges til billede-index). */
export function locateAeonJson(buf: ArrayBuffer): LocatedAeonJson {
  const bytes = new Uint8Array(buf);
  const enc = (s: string) => [...new TextEncoder().encode(s)];
  const starts: number[] = [];
  for (const pat of ['{"fileVersion"', '{"definitions"', '{"data"']) {
    for (let i = 0; ; i++) {
      const p = indexOfBytes(bytes, enc(pat), i);
      if (p < 0) break;
      starts.push(p);
      i = p + 1;
    }
  }
  if (!starts.length) throw new Error('Ikke en .aeon-fil (ingen JSON-blok fundet)');
  starts.sort((a, b) => a - b);
  for (const s of starts) {
    const end = matchJsonEnd(bytes, s);
    if (end < 0) continue;
    let doc: AeonDoc;
    try {
      doc = normalizeAeonDoc(JSON.parse(utf8Decoder.decode(bytes.subarray(s, end))));
    } catch {
      continue; // naeste kandidat (blobben kan vaere indlejret i en anden)
    }
    if (doc?.definitions?.types?.byId && doc?.data?.items?.byId) return { doc, jsonStart: s };
  }
  throw new Error('Kunne ikke fortolke .aeon-indholdet som JSON');
}

/** Find og parse Aeon's JSON-blob i en .aeon-fil. Kaster hvis intet gyldigt findes. */
export function findAeonJson(buf: ArrayBuffer): AeonDoc {
  return locateAeonJson(buf).doc;
}

// ---- datemapping ----
/** Aeon's era: 0 = f.Kr. med positivt årstal → astronomisk (1 f.Kr. = 0). */
export function aeonToDV(sd: AeonDate | null | undefined): DateValue | undefined {
  if (!sd || sd.precision < 0 || sd.year == null) return undefined;
  const y = sd.era === 0 ? 1 - sd.year : sd.year;
  let precision: DateValue['precision'] = 'year';
  if (sd.precision === 1) precision = 'month';
  else if (sd.precision >= 2) precision = 'day';
  const dv: DateValue = { y, precision };
  if (sd.precision >= 1 && sd.month) dv.mo = sd.month;
  if (sd.precision >= 2 && sd.day) dv.d = sd.day;
  if (sd.precision >= 8 && (sd.hour || sd.minute || sd.second)) {
    precision = 'time';
    dv.precision = 'time';
    dv.h = sd.hour ?? 0; dv.mi = sd.minute ?? 0; dv.s = sd.second ?? 0;
  }
  return dv;
}

function aeonToDur(d: AeonDuration | null | undefined): Duration | undefined {
  if (!d) return undefined;
  const out: Duration = {};
  if (d.years) out.y = d.years;
  if (d.months) out.mo = d.months;
  const days = (d.weeks ?? 0) * 7 + (d.days ?? 0);
  if (days) out.d = days;
  if (d.hours) out.h = d.hours;
  if (d.minutes) out.mi = d.minutes;
  if (d.seconds) out.s = d.seconds;
  return Object.keys(out).length ? out : undefined;
}

function aeonToSpan(it: AeonItem): Span {
  const start = aeonToDV(it.startDate);
  const span: Span = {};
  if (!start) return span; // dato-løs post (fx slægtsled uden årstal)
  span.start = start;
  const dur = aeonToDur(it.duration);
  if (dur) span.duration = dur;
  if (it.ongoing) span.ongoing = true;
  const latest = aeonToDV(it.latestStartDate);
  if (latest) {
    span.uncertain ??= {};
    span.uncertain.latestStart = latest;
  }
  const d2ee = aeonToDur(it.durationToEarliestEnd);
  if (d2ee) {
    span.uncertain ??= {};
    span.uncertain.earliestEnd = addDuration(start, d2ee);
  }
  return span;
}

// CSS-kendte farver; ukendte → null (brug standardtypefarve)
const CSS_COLORS = new Set(['yellow', 'orange', 'red', 'green', 'blue', 'purple', 'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta']);
function aeonColor(hexOrName: string | undefined, colors: AeonRaw['definitions']['colors']): string | undefined {
  if (!hexOrName) return undefined;
  const sw = colors.byId[hexOrName]?.swatchColor;
  if (!sw) return undefined;
  if (/^#[0-9a-fA-F]{3,8}$/.test(sw)) return sw;
  return CSS_COLORS.has(sw.toLowerCase()) ? sw.toLowerCase() : undefined;
}

const TYPE_PALETTE = ['#4a90d9', '#59a14f', '#d9a441', '#a865c8', '#d96a6a', '#5fb3b3', '#b3b35f', '#8a6ad9', '#d98a3d', '#3dd9a4'];

// ---- Billede-index parsing (M11) ----
/**
 * Aeon's binære format: [image blobs][JSON][zero-pad][footer-index].
 * Image-index records: [idLen:4LE][fnameLen:4LE][id:idLen][filename:fnameLen][offset:8LE][size:8LE]...
 * Scan region umiddelbart før JSON-start for disse records.
 */
export function extractAeonImages(buf: ArrayBuffer, jsonStartHint = -1): AeonImage[] {
  const bytes = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const enc = (s: string) => [...new TextEncoder().encode(s)];

  // find JSON start (billederne ligger i preambleen forfor)
  let jsonStart = jsonStartHint;
  if (jsonStart < 0) {
    outer0: for (const pat of ['{"fileVersion"', '{"definitions"', '{"data"']) {
      const p = indexOfBytes(u8, enc(pat));
      if (p >= 0) { jsonStart = p; break outer0; }
    }
  }
  if (jsonStart < 0) return [];

  // scan region foran JSON for image-index records (storre billedsammlinger kan traenge til mere)
  const scanStart = Math.max(0, jsonStart - 64000);
  // Aeon 3.15+ pakker resourcer ind i en "indexed archive": sa er offsets relative til headeren,
  // og ressourcer kan ligge BAAREFTER JSON-blobben. Oldere form: absolute offsets foer JSON.
  const header = 'app.timeline.indexedArchive';
  const isArchive = [...new TextEncoder().encode(header)].every((c, i) => u8[i] === c);
  const bases = isArchive ? [header.length, 0] : [0];
  const maxEnd = isArchive ? u8.length : jsonStart;
  const images: AeonImage[] = [];
  const seen = new Set<string>();

  let pos = scanStart;
  while (pos < jsonStart - 24) {
    const idLen = bytes.getUint32(pos, true);
    const fnameLen = bytes.getUint32(pos + 4, true);
    if (idLen < 8 || idLen > 40 || fnameLen < 1 || fnameLen > 200) { pos++; continue; }
    // read id
    const id = new TextDecoder().decode(u8.subarray(pos + 8, pos + 8 + idLen));
    // Aeon bruger baade UUID'er og korte base58-id'er (fx "FiBLTR4P596XqkQB6oPJH")
    if (!/^[0-9A-Za-z_\-]{8,40}$/.test(id)) { pos++; continue; }
    const filename = new TextDecoder().decode(u8.subarray(pos + 8 + idLen, pos + 8 + idLen + fnameLen));
    const dataStart = pos + 8 + idLen + fnameLen;
    if (dataStart + 16 > jsonStart) { pos++; continue; }
    // offset og size som 8-byte little-endian
    const rawOffset = bytes.getUint32(dataStart, true) + bytes.getUint32(dataStart + 4, true) * 0x100000000;
    const size = bytes.getUint32(dataStart + 8, true) + bytes.getUint32(dataStart + 12, true) * 0x100000000;
    // prova alle base-kandidater (archive-relativ eller absolut) og godkend pa magiske bytes
    let offset = -1, mimeType = '';
    for (const base of bases) {
      const cand = rawOffset + base;
      if (size < 100 || size > 50_000_000 || cand + size > maxEnd) continue;
      const m0 = u8[cand], m1 = u8[cand + 1];
      if (m0 === 0x89 && m1 === 0x50) { offset = cand; mimeType = 'image/png'; break; }
      if (m0 === 0xff && m1 === 0xd8) { offset = cand; mimeType = 'image/jpeg'; break; }
      if (m0 === 0x47 && m1 === 0x49) { offset = cand; mimeType = 'image/gif'; break; }
    }
    if (offset < 0) { pos++; continue; }
    if (seen.has(id)) { pos = dataStart + 16; continue; }
    seen.add(id);
    images.push({ id, blob: buf.slice(offset, offset + size), mimeType, filename });
    pos = dataStart + 16; // skip to next record
  }
  return images;
}

/** Hoved-import: .aeon-buffer → vores TimelineDoc + billeder + advarsler. */
export function importAeon(buf: ArrayBuffer, docName?: string): { doc: TimelineDoc; images: AeonImage[]; warnings: string[] } {
  const { doc: raw, jsonStart } = locateAeonJson(buf);
  const images = extractAeonImages(buf, jsonStart);
  const imageIdSet = new Set(images.map((i) => i.id));
  const warnings: string[] = [];

  // item-typer (spring "genericNode"/mindmap-noder fra — de er ikke tidsposter)
  const skipTypes = new Set(['genericNode']);
  const typeIds = Object.keys(raw.definitions.types.byId).filter((t) => raw.definitions.types.byId[t].enabled !== false && !skipTypes.has(t));
  const itemTypes = typeIds.map((id, i) => ({
    id,
    name: raw.definitions.types.byId[id].label || id,
    color: TYPE_PALETTE[i % TYPE_PALETTE.length],
  }));
  const typeIdSet = new Set(typeIds);

  // tags id → navn
  const tagNames = raw.data.tags ?? {};

  // poster
  const items: Item[] = [];
  let dropped = 0;
  for (const ai of Object.values(raw.data.items.byId)) {
    if (skipTypes.has(ai.type)) continue;
    if (!typeIdSet.has(ai.type)) { warnings.push(`Ukendt type "${ai.type}" — springer over "${ai.label}"`); dropped++; continue; }
    const span = aeonToSpan(ai);
    const item: Item = { id: ai.id, typeId: ai.type, label: ai.label || '(uden navn)', span };
    if (ai.summary) item.notes = ai.summary;
    if (ai.color) item.color = aeonColor(ai.color, raw.definitions.colors) ?? undefined;
    if (ai.super && typeIdSet.has(raw.data.items.byId[ai.super]?.type ?? '')) item.parentId = ai.super;
    const tags = (ai.tags ?? []).map((t) => tagNames[t]).filter(Boolean);
    if (tags.length) item.tags = tags;
    if (ai.image && imageIdSet.has(ai.image)) item.imageId = ai.image;
    items.push(item);
  }

  // relationstyper: parentRef → vores rt-parent; øvrige generiske fra definitions.references
  const relationTypes: RelationType[] = [];
  const relTypeMap = new Map<string, string>(); // aeon-ref-id → vores typeId
  const usedRefs = new Set((Object.values(raw.data.relationships?.byId ?? {}) as { reference: string }[]).map((r) => r.reference));
  for (const refId of usedRefs) {
    if (refId === 'parentRef') { relTypeMap.set(refId, 'rt-parent'); continue; }
    const def = raw.definitions.references.byId[refId];
    const name = def?.label || refId;
    const rt: RelationType = { id: `aeon-${refId}`, name, reverseName: def?.inverseLabel || name };
    relationTypes.push(rt);
    relTypeMap.set(refId, rt.id);
  }
  // ensure rt-parent findes
  if (usedRefs.has('parentRef') && !relationTypes.some((t) => t.id === 'rt-parent')) {
    relationTypes.unshift({ id: 'rt-parent', name: 'Forælder', reverseName: 'Barn' });
  }

  // relationer: Aeon {subject, reference, object} = "subjects <reference> er object".
  // parentRef vendes om så from = forælder (object), to = barn (subject) — ligesom vores demo.
  const relations: Relation[] = [];
  const seen = new Set<string>();
  for (const r of Object.values(raw.data.relationships?.byId ?? {}) as { id: string; subject: string; reference: string; object: string }[]) {
    const typeId = relTypeMap.get(r.reference);
    if (!typeId) continue;
    const has = (id: string) => items.some((i) => i.id === id);
    if (!has(r.subject) || !has(r.object)) continue;
    const [fromId, toId] = r.reference === 'parentRef' ? [r.object, r.subject] : [r.subject, r.object];
    const key = `${typeId}|${fromId}|${toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({ id: `aeonrel-${r.id}`, fromId, toId, typeId });
  }

  const noDate = items.filter((i) => !i.span.start).length;
  if (noDate) warnings.push(`${noDate} poster uden dato importeret (vises kun i Ark)`);
  if (dropped) warnings.push(`${dropped} poster sprunget over (ukendt type)`);

  const doc: TimelineDoc = {
    version: 1,
    name: docName ?? 'Importeret Aeon-tidslinje',
    itemTypes: itemTypes.length ? itemTypes : [{ id: 'defaultEvent', name: 'Begivenelse', color: TYPE_PALETTE[0] }],
    relationTypes,
    items: items.map((it) => ({ ...it, span: syncSpan(it.span).span ?? it.span })),
    relations,
  };
  return { doc, images, warnings };
}
