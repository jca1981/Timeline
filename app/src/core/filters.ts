// **** Filter-logik: anvend filtre på items (M4) ****
import type { Item, Filter } from '../model/doc';
import { toJD } from './jdn';

/** Returnerer true hvis item matcher filteret. */
export function matchesFilter(item: Item, filter: Filter | null | undefined): boolean {
  if (!filter) return true;

  const checks: boolean[] = [];

  // Type-filter
  if (filter.types && filter.types.length > 0) {
    checks.push(filter.types.includes(item.typeId));
  }

  // Tag-filter
  if (filter.tags && filter.tags.length > 0) {
    const itemTags = item.tags ?? [];
    checks.push(filter.tags.some((t) => itemTags.includes(t)));
  }

  // Date range filter (JDN integers)
  if (filter.dateRange) {
    const startJD = item.span.start ? toJD(item.span.start) : null;
    const endJD = item.span.end ? toJD(item.span.end) : null;
    const from = filter.dateRange.from;
    const to = filter.dateRange.to;

    if (from != null || to != null) {
      // Item skal overlappe datoperioden
      let inRange = false;
      if (startJD != null && endJD != null) {
        inRange = (from == null || endJD >= from) && (to == null || startJD <= to);
      } else if (startJD != null) {
        inRange = (from == null || startJD >= from) && (to == null || startJD <= to);
      } else if (endJD != null) {
        inRange = (from == null || endJD >= from) && (to == null || endJD <= to);
      } else {
        // Ingen dato — inkludere altid (usikkerhed)
        inRange = true;
      }
      checks.push(inRange);
    }
  }

  // Text search (label + notes)
  if (filter.text && filter.text.trim()) {
    const q = filter.text.toLowerCase().trim();
    const haystack = `${item.label} ${item.notes ?? ''}`.toLowerCase();
    checks.push(haystack.includes(q));
  }

  if (checks.length === 0) return true;

  return filter.match === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

/** Filtrér items efter filter. */
export function applyFilter(items: Item[], filter: Filter | null | undefined): Item[] {
  if (!filter) return items;
  return items.filter((it) => matchesFilter(it, filter));
}
