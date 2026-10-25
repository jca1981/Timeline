// **** Kilder som førsteklasses data (M28/M29): bibliotek, dedup, citationstal, sikre links ****
import type { Item, Source, SourceKind, TimelineDoc } from '../model/doc';

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
    for (const id of new Set(it.sourceIds ?? [])) {
      // en post tæller kun én gang pr. kilde, selv med dupe-id'er i sourceIds
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

// ---- M29: kildetyper, troværdighed og døde links ----

/** Kildetyper i den rækkefølge de skal vises (direkte øjenvidne først). */
export const SOURCE_KINDS: SourceKind[] = ['primær', 'sekundær', 'tertiær'];

/** Troværdighedsskala. Værdierne (1-5) gemmes i dokumentet, labels vises. */
export const RELIABILITY: { v: number; label: string }[] = [
  { v: 5, label: 'yderst troværdig' },
  { v: 4, label: 'meget troværdig' },
  { v: 3, label: 'nogenlunde troværdig' },
  { v: 2, label: 'tvivlsom' },
  { v: 1, label: 'dårlig' },
];

export function reliabilityLabel(v?: number): string {
  if (!v) return 'ikke vurderet';
  return RELIABILITY.find((r) => r.v === v)?.label ?? `bedømmelse ${v}`;
}

/** Punkt-skala til UI: ★★★☆☆ (undefined = ingen prikker = ikke vurderet). */
export function reliabilityStars(v?: number): string {
  if (!v) return '—';
  const n = Math.max(0, Math.min(5, Math.round(v)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/** Procent (Aeons percentage-format) → 1-5 skala. */
export function reliabilityFromPct(pct: number): number {
  const p = Math.max(0, Math.min(1, pct));
  return Math.max(1, Math.min(5, Math.round(p * 4) + 1));
}

/** Er kilden en URL, der kan do? (bog uden link er ikke “uprøvet”). */
export function isLinkSource(s: Source): boolean {
  return !!safeUrl(s.url);
}

/**
 * Link der burde tjekkes: har URL og er aldrig bekræftet, eller sidste tjek er
 * ældre end `days`. Tom todayIso = i dag.
 */
export function isStaleLink(s: Source, days = 365, todayIso?: string): boolean {
  if (!isLinkSource(s)) return false;
  if (!s.checkedAt) return true;
  const then = Date.parse(s.checkedAt);
  const now = todayIso ? Date.parse(todayIso) : Date.now();
  if (Number.isNaN(then)) return true;
  return now - then > days * 86_400_000;
}

/** Alle kilder med link, der aldrig er tjekket eller er gamle. */
export function staleLinks(doc: TimelineDoc, days = 365, todayIso?: string): Source[] {
  return (doc.sources ?? []).filter((s) => isStaleLink(s, days, todayIso));
}

/**
 * Visningsrækkefølge: mest brugte først, derefter bedst vurderede, til sidst
 * titel — så flest citerede og bedst vurderede kilder lægges øverst.
 */
export function sortSources(list: Source[], cites?: Map<string, Item[]>): Source[] {
  return [...list].sort((a, b) => {
    const n = (cites?.get(b.id)?.length ?? 0) - (cites?.get(a.id)?.length ?? 0);
    if (n !== 0) return n;
    const r = (b.reliability ?? 0) - (a.reliability ?? 0);
    if (r !== 0) return r;
    return citeLabel(a).localeCompare(citeLabel(b), 'da');
  });
}
