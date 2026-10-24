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

/** Find og parse Aeon's JSON-blob i en .aeon-fil. Kaster hvis intet gyldigt findes. */
export function findAeonJson(buf: ArrayBuffer): AeonDoc {
  const bytes = new Uint8Array(buf);
  const enc = (s: string) => [...new TextEncoder().encode(s)];
  // JSON-blobben slutter ved sidste } før zero-padding efter "fileVersion"
  const fv = indexOfBytes(bytes, enc('"fileVersion"'));
  if (fv < 0) throw new Error('Ikke en .aeon-fil (ingen "fileVersion" fundet)');
  let end = indexOfBytes(bytes, enc('}'), fv);
  if (end < 0) throw new Error('Ufuldstændig .aeon-fil');
  end += 1;

  const starts: number[] = [];
  for (const pat of ['{"definitions"', '{"data"']) {
    for (let i = 0; ; i++) {
      const p = indexOfBytes(bytes, enc(pat), i);
      if (p < 0 || p >= end) break;
      starts.push(p);
      i = p + 1;
    }
  }
  // mindste kandidater (= hele dokumentet) først
  starts.sort((a, b) => a - b);
  for (const s of starts) {
    try {
      return JSON.parse(utf8Decoder.decode(bytes.subarray(s, end))) as AeonDoc;
    } catch {
      /* næste kandidat */
    }
  }
  throw new Error('Kunne ikke fortolke .aeon-indholdet som JSON');
}
type AeonDoc = AeonRaw;

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
export function extractAeonImages(buf: ArrayBuffer): AeonImage[] {
  const bytes = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const enc = (s: string) => [...new TextEncoder().encode(s)];

  // find JSON start
  const jsonPat = enc('{"definitions"');
  let jsonStart = -1;
  outer0: for (let i = 0; i <= u8.length - jsonPat.length; i++) {
    for (let j = 0; j < jsonPat.length; j++) if (u8[i + j] !== jsonPat[j]) continue outer0;
    jsonStart = i; break;
  }
  if (jsonStart < 0) return [];

  // scan last ~10 KB before JSON for image index records
  const scanStart = Math.max(0, jsonStart - 12000);
  const images: AeonImage[] = [];
  const seen = new Set<string>();

  let pos = scanStart;
  while (pos < jsonStart - 24) {
    const idLen = bytes.getUint32(pos, true);
    const fnameLen = bytes.getUint32(pos + 4, true);
    if (idLen < 8 || idLen > 40 || fnameLen < 1 || fnameLen > 200) { pos++; continue; }
    // read id
    const id = new TextDecoder().decode(u8.subarray(pos + 8, pos + 8 + idLen));
    // basic UUID or short-id check
    if (!/^[0-9A-Fa-f\-]{8,40}$/.test(id)) { pos++; continue; }
    const filename = new TextDecoder().decode(u8.subarray(pos + 8 + idLen, pos + 8 + idLen + fnameLen));
    const dataStart = pos + 8 + idLen + fnameLen;
    if (dataStart + 16 > jsonStart) { pos++; continue; }
    // offset + size as big-endian 64-bit? Actually LE.
    const offset = bytes.getUint32(dataStart, true) + bytes.getUint32(dataStart + 4, true) * 0x100000000;
    const size = bytes.getUint32(dataStart + 8, true) + bytes.getUint32(dataStart + 12, true) * 0x100000000;
    // validate: offset+size must fit in preamble
    if (offset + size > jsonStart || size < 100 || size > 50_000_000) { pos++; continue; }
    // validate magic bytes at offset
    const m0 = u8[offset], m1 = u8[offset + 1];
    let mimeType: string;
    if (m0 === 0x89 && m1 === 0x50) mimeType = 'image/png';
    else if (m0 === 0xFF && m1 === 0xD8) mimeType = 'image/jpeg';
    else if (m0 === 0x47 && m1 === 0x49) mimeType = 'image/gif';
    else { pos++; continue; }
    if (seen.has(id)) { pos = dataStart + 16; continue; }
    seen.add(id);
    images.push({ id, blob: buf.slice(offset, offset + size), mimeType, filename });
    pos = dataStart + 16; // skip to next record
  }
  return images;
}

/** Hoved-import: .aeon-buffer → vores TimelineDoc + billeder + advarsler. */
export function importAeon(buf: ArrayBuffer, docName?: string): { doc: TimelineDoc; images: AeonImage[]; warnings: string[] } {
  const raw = findAeonJson(buf);
  const images = extractAeonImages(buf);
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
