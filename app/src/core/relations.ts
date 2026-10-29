// **** Relations-hjælpere: retning, labels, matrix-opslag (M3) ****
import type { Relation, RelationType, TimelineDoc } from '../model/doc';

export interface Link {
  rel: Relation;
  type: RelationType;
  otherId: string;
  /** "Forælder" (denne post er from) eller "Barn" (denne post er to). */
  label: string;
}

export function relationTypes(doc: TimelineDoc): RelationType[] {
  return doc.relationTypes ?? [];
}

export function relType(doc: TimelineDoc, typeId: string): RelationType | undefined {
  return relationTypes(doc).find((t) => t.id === typeId);
}

/** Alle relationer omkring en post, med korrekt retningsetiket. */
export function linksOf(doc: TimelineDoc, itemId: string): Link[] {
  const out: Link[] = [];
  for (const rel of doc.relations ?? []) {
    const type = relType(doc, rel.typeId);
    if (!type) continue;
    if (rel.fromId === itemId) out.push({ rel, type, otherId: rel.toId, label: type.name });
    else if (rel.toId === itemId) out.push({ rel, type, otherId: rel.fromId, label: type.reverseName });
  }
  return out;
}

export function findRelation(doc: TimelineDoc, fromId: string, toId: string, typeId: string): Relation | undefined {
  return (doc.relations ?? []).find((r) => r.typeId === typeId && r.fromId === fromId && r.toId === toId);
}

/** Forælder-barn-kæde: antal led fra `ancestor` til `descendant` (via rt-parent), -1 hvis ikke forbundet. */
export function generations(doc: TimelineDoc, ancestorId: string, descendantId: string): number {
  const parentsOf = new Map<string, string[]>();
  for (const r of doc.relations ?? []) {
    if (r.typeId !== 'rt-parent') continue;
    parentsOf.set(r.toId, [...(parentsOf.get(r.toId) ?? []), r.fromId]);
  }
  const visited = new Set<string>([descendantId]);
  let frontier = [descendantId];
  let depth = 0;
  while (frontier.length) {
    if (frontier.includes(ancestorId)) return depth;
    const next: string[] = [];
    for (const id of frontier) for (const p of parentsOf.get(id) ?? []) if (!visited.has(p)) { visited.add(p); next.push(p); }
    frontier = next;
    depth++;
    if (depth > 200) break; // sløjfe-guard
  }
  return -1;
}

export interface FulfillmentArc {
  prophecyId: string;
  fulfillmentId: string;
  note?: string;
}

/** Alle profeti→opfyldelse-relationer i doc (rt-fulfillment). */
export function fulfillmentArcs(doc: TimelineDoc): FulfillmentArc[] {
  return (doc.relations ?? [])
    .filter((r) => r.typeId === 'rt-fulfillment')
    .map((r) => ({ prophecyId: r.fromId, fulfillmentId: r.toId, note: r.note }));
}
