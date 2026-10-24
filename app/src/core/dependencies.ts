// **** Dependency-logik: oprettelse, konflikt-detektion (M4) ****
import type { Dependency, DepKind, TimelineDoc, Item } from '../model/doc';
import { toJD } from './jdn';

/** Beskrivelse af en dependency-kind (til tooltips/labels). */
export const DEP_KIND_LABELS: Record<DepKind, string> = {
  FS: 'Slut → Start (FS)',
  FF: 'Slut → Slut (FF)',
  SS: 'Start → Start (SS)',
  SF: 'Start → Slut (SF)',
};

export const DEP_KIND_SHORT: Record<DepKind, string> = {
  FS: 'FS', FF: 'FF', SS: 'SS', SF: 'SF',
};

/** Get the relevant date-part (start/end JDN) for an item's span. Returns null if missing. */
function getPart(item: Item, part: 'start' | 'end'): number | null {
  const d = part === 'start' ? item.span.start : item.span.end;
  if (!d) return null;
  return toJD(d);
}

/** Er en dependency brudt? FS: blocker.slut ≤ blocked.start, etc. */
export function isDependencyViolated(dep: Dependency, doc: TimelineDoc): boolean {
  const blocker = doc.items.find((it) => it.id === dep.blockerId);
  const blocked = doc.items.find((it) => it.id === dep.blockedId);
  if (!blocker || !blocked) return false;

  const kind = dep.kind;
  const blockerPart = kind.startsWith('F') ? 'end' : 'start';
  const blockedPart = kind.endsWith('S') ? 'start' : 'end';

  const bJD = getPart(blocker, blockerPart as 'start' | 'end');
  const dJD = getPart(blocked, blockedPart as 'start' | 'end');
  if (bJD === null || dJD === null) return false; // manglende dato = kan ikke evaluere

  // Constraint: blocker-part ≤ blocked-part
  // Violation when blocker-part > blocked-part
  return bJD > dJD;
}

/** Return all violated dependencies in the document. */
export function violatedDependencies(doc: TimelineDoc): Dependency[] {
  return (doc.dependencies ?? []).filter((d) => isDependencyViolated(d, doc));
}

/** Find all dependencies involving a specific item (either as blocker or blocked). */
export function dependenciesOf(doc: TimelineDoc, itemId: string): Array<Dependency & { role: 'blocker' | 'blocked' }> {
  return (doc.dependencies ?? [])
    .filter((d) => d.blockerId === itemId || d.blockedId === itemId)
    .map((d) => ({ ...d, role: d.blockerId === itemId ? 'blocker' as const : 'blocked' as const }));
}

/** Valid dependencies (not self-ref, both items exist). */
export function validDependency(doc: TimelineDoc, blockerId: string, blockedId: string): string | null {
  if (blockerId === blockedId) return 'Kan ikke blokere sig selv';
  if (!doc.items.find((it) => it.id === blockerId)) return 'Blocker findes ikke';
  if (!doc.items.find((it) => it.id === blockedId)) return 'Blocked findes ikke';
  return null;
}
