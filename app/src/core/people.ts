// **** Person-data (M30): personer som eget overblik — levetid, familie, fødested, kilder ****
// En "person" er en post af en person-type. Familien findes via rt-parent-relationer
// (from = forælder, to = barn), ægtefæller/fødested via de relationstyper importen lavede.
import type { Item, RelationType, TimelineDoc } from '../model/doc';
import type { DateValue } from './types';
import { displayYear } from './format';

/** Type-heuristik: Aeons "Person"/"defaultPerson", vores egen "t-person". */
const PERSON_NAME_RE = /^(person|personer|people|individ|individual|familiemedlem)\b/i;
const PERSON_ID_RE = /(^|[^a-z])person/i;

/** Relationstyper der matcher en familie-/personrolle (på id, navn eller omvendt navn). */
function matchesRel(re: RegExp) {
  return (t: RelationType): boolean => re.test(t.id) || re.test(t.name ?? '') || re.test(t.reverseName ?? '');
}
export const isParentRelType = matchesRel(/rt-parent|parentref|for\u00e6lder|barn/i);
export const isSpouseRelType = matchesRel(/spouse|partner|\u00e6gtef|gift/i);
export const isBirthplaceRelType = matchesRel(/birthplace|f\u00f8dested|f\u00f8dt/i);

const BIRTH_RE = /f\u00f8dsel|f\u00f8dt|birth|born/i;
const DEATH_RE = /d\u00f8d|d\u00f8de|\bd\u00f8r\b|death|died/i;

/** Person-typer i dokumentet. Finder ingen = brug alle der indgår i familie-relationer. */
export function personTypeIds(doc: TimelineDoc): Set<string> {
  const out = new Set<string>();
  for (const t of doc.itemTypes ?? []) {
    if (PERSON_NAME_RE.test((t.name ?? '').trim()) || PERSON_ID_RE.test(t.id ?? '')) out.add(t.id);
  }
  if (out.size) return out;
  // fallback: posten er person, hvis den optræder i en forælder-relation
  for (const r of doc.relations ?? []) {
    const t = (doc.relationTypes ?? []).find((x) => x.id === r.typeId);
    if (t && isParentRelType(t)) { out.add(doc.items.find((i) => i.id === r.fromId)?.typeId ?? ''); out.add(doc.items.find((i) => i.id === r.toId)?.typeId ?? ''); }
  }
  out.delete('');
  return out;
}

export interface PersonRow {
  item: Item;
  typeName: string;
  color?: string;
  birth?: DateValue;
  death?: DateValue;
  parents: Item[];
  children: Item[];
  spouses: Item[];
  places: Item[]; // fødesteder o.l.
  cites: number; // poster (personen selv) med kildehenvisninger
}

export type PeopleSort = 'navn' | 'levetid' | 'barn' | 'kilde';

/** Livstid for en person: egen dato ellers "Fødsel"/"Død"-undersager. */
function lifeOf(item: Item, related: Item[]): { birth?: DateValue; death?: DateValue } {
  const birth = item.span?.start;
  const death = item.span?.end;
  if (birth || death) return { birth, death };
  let b: DateValue | undefined, d: DateValue | undefined;
  for (const c of related) {
    const label = c.label ?? '';
    if (BIRTH_RE.test(label) && c.span?.start && (!b || c.span.start.y < b.y)) b = c.span.start;
    if (DEATH_RE.test(label)) {
      const at = c.span?.start ?? c.span?.end;
      if (at && (!d || at.y > d.y)) d = at;
    }
  }
  return { birth: b, death: d };
}

/** Alle personer med familie, levetid og kildeantal — klar til tabel. */
export function peopleOf(doc: TimelineDoc): PersonRow[] {
  const types = personTypeIds(doc);
  if (!types.size) return [];
  const byId = new Map(doc.items.map((i) => [i.id, i]));
  const relTypes = new Map((doc.relationTypes ?? []).map((t) => [t.id, t]));
  const parents = new Map<string, Item[]>();
  const children = new Map<string, Item[]>();
  const spouses = new Map<string, Item[]>();
  const places = new Map<string, Item[]>();
  const push = (m: Map<string, Item[]>, id: string, it: Item) => {
    const list = m.get(id);
    if (list) { if (!list.some((x) => x.id === it.id)) list.push(it); } else m.set(id, [it]);
  };

  for (const r of doc.relations ?? []) {
    const t = relTypes.get(r.typeId);
    if (!t) continue;
    const a = byId.get(r.fromId), b = byId.get(r.toId);
    if (!a || !b) continue;
    if (isParentRelType(t)) { push(children, a.id, b); push(parents, b.id, a); }
    else if (isSpouseRelType(t)) { push(spouses, a.id, b); push(spouses, b.id, a); }
    else if (isBirthplaceRelType(t)) { push(places, a.id, b); push(places, b.id, a); }
  }

  const typeName = new Map((doc.itemTypes ?? []).map((t) => [t.id, t]));
  // hierarchy (parentId) tæller også som forælder/barn — import sætter den på alle poster
  for (const it of doc.items) {
    const p = it.parentId ? byId.get(it.parentId) : undefined;
    if (p) { push(parents, it.id, p); push(children, p.id, it); }
  }
  const rows: PersonRow[] = [];
  for (const it of doc.items) {
    if (!types.has(it.typeId)) continue;
    const kids = [...(children.get(it.id) ?? [])];
    const kin = [...kids, ...(parents.get(it.id) ?? []), ...(spouses.get(it.id) ?? [])];
    const t = typeName.get(it.typeId);
    rows.push({
      item: it,
      typeName: t?.name ?? it.typeId,
      color: it.color ?? t?.color,
      ...lifeOf(it, kin),
      parents: parents.get(it.id) ?? [],
      children: kids,
      spouses: spouses.get(it.id) ?? [],
      places: places.get(it.id) ?? [],
      cites: (it.sourceIds ?? []).length,
    });
  }
  return sortPeople(rows, 'levetid');
}

const birthYear = (r: PersonRow): number => r.birth?.y ?? r.death?.y ?? Number.MAX_SAFE_INTEGER;

export function sortPeople(rows: PersonRow[], by: PeopleSort): PersonRow[] {
  const out = [...rows];
  if (by === 'navn') out.sort((a, b) => a.item.label.localeCompare(b.item.label, 'da'));
  else if (by === 'barn') out.sort((a, b) => b.children.length - a.children.length || a.item.label.localeCompare(b.item.label, 'da'));
  else if (by === 'kilde') out.sort((a, b) => b.cites - a.cites || a.item.label.localeCompare(b.item.label, 'da'));
  else out.sort((a, b) => birthYear(a) - birthYear(b) || a.item.label.localeCompare(b.item.label, 'da'));
  return out;
}

/** "f. 1548 f.Kr. – d. 1410 f.Kr." / "levete 29 f.Kr." / "—" */
export function lifespanText(r: PersonRow): string {
  if (r.birth && r.death) return `f. ${displayYear(r.birth.y)} – d. ${displayYear(r.death.y)}`;
  if (r.birth) return `f. ${displayYear(r.birth.y)}`;
  if (r.death) return `d. ${displayYear(r.death.y)}`;
  return '';
}

export function peopleStats(rows: PersonRow[]): { dated: number; families: number; cited: number; lonely: number } {
  return {
    dated: rows.filter((r) => r.birth || r.death).length,
    families: rows.filter((r) => r.children.length > 0).length,
    cited: rows.filter((r) => r.cites > 0).length,
    lonely: rows.filter((r) => !r.children.length && !r.parents.length && !r.spouses.length).length,
  };
}
