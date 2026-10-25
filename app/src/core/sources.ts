// **** Kilder som førsteklasses data (M28): bibliotek, dedup, citationstal, sikre links ****
import type { Item, Source, TimelineDoc } from '../model/doc';

/**
 * URL til link i UI/eksport. Kun http/https slipper igennem — en importeret eller
 * manuelt indtastet `javascript:`/`data:`-URL ellers bliver et klikkbart XSS-hull
 * i den ellers selvstående eksportfil. Returnerer null = vis tekst uden link.
 */
export function safeUrl(url?: string): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
}

/** Visningstekst for en kilde: "Studies i Skriften — s. 214". */
export function citeLabel(s: Source): string {
  const loc = (s.locator ?? '').trim();
  const title = (s.title ?? '').trim() || '(titel mangler)';
  return loc ? `${title} — ${loc}` : title;
}

const norm = (v?: string) => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Nøgle der fanger den samme kilde skrevet to gange ("s. 214" == "S.  214"). */
export function sourceKey(s: Pick<Source, 'title' | 'locator' | 'url'>): string {
  return `${norm(s.title)}|${norm(s.locator)}|${safeUrl(s.url) ?? ''}`;
}

/** Find eksisterende kilde der er identisk (til dedup ved oprettelse/import). */
export function findDuplicateSource(list: Source[], cand: Pick<Source, 'title' | 'locator' | 'url'>): Source | undefined {
  const key = sourceKey(cand);
  return list.find((s) => sourceKey(s) === key);
}

/** Slår en posts kilde-id'er op (id'er der peger på en slettet kilde, ignoreres). */
export function sourcesOf(doc: TimelineDoc, item: Item): Source[] {
  const byId = new Map((doc.sources ?? []).map((s) => [s.id, s]));
  return (item.sourceIds ?? []).map((id) => byId.get(id)).filter((s): s is Source => !!s);
}

/** Alle poster der citerer hver kilde — til "Kilder"-visning og tælling. */
export function citationsBySource(doc: TimelineDoc): Map<string, Item[]> {
  const out = new Map<string, Item[]>();
  for (const s of doc.sources ?? []) out.set(s.id, []);
  for (const it of doc.items) {
    for (const id of it.sourceIds ?? []) {
      const arr = out.get(id);
      if (arr) arr.push(it);
    }
  }
  return out;
}

/**
 * Nummerering til eksport: kilder nummereres efter første optræden i den
 * sorterede liste, så [1] i brødteksten matcher kildelisten nederst.
 */
export function bibliography(doc: TimelineDoc, items: Item[]): { list: Source[]; numbers: Map<string, number[]> } {
  const list: Source[] = [];
  const num = new Map<string, number>();
  const numbers = new Map<string, number[]>();
  for (const it of items) {
    const mine: number[] = [];
    for (const id of it.sourceIds ?? []) {
      const src = (doc.sources ?? []).find((s) => s.id === id);
      if (!src) continue;
      if (!num.has(id)) {
        list.push(src);
        num.set(id, list.length);
      }
      const n = num.get(id)!;
      if (!mine.includes(n)) mine.push(n);
    }
    if (mine.length) numbers.set(it.id, mine);
  }
  return { list, numbers };
}
