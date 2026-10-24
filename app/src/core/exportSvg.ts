// **** M20: SVG-eksport — generér standalone SVG fra tidslinje-dokument ****
import type { TimelineDoc, Item } from '../model/doc';
import { spanBounds, contentBounds, ticksFor } from './scale';
import { applyFilter } from './filters';
import type { Filter } from '../model/doc';

export function exportAsSvg(doc: TimelineDoc, filter?: Filter): string {
  const items = filter ? applyFilter(doc.items, filter) : doc.items;
  const rows = items
    .map((it) => ({ it, bd: spanBounds(it.span) }))
    .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
    .sort((a, b) => a.bd.a - b.bd.a);

  if (!rows.length) return '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">Tomt dokument</text></svg>';

  const cb = contentBounds(rows.map((r) => r.it.span));
  if (!cb) return '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">Ingen dato</text></svg>';

  const px = 1 / 365; // pixel/day for overview
  const W = Math.max(800, (cb.right - cb.left) * px);
  const H = rows.length * 24 + 60;
  const x = (jd: number) => (jd - cb.left) * px + 10;

  const typeColor = (it: Item): string => {
    if (it.color) return it.color;
    const t = doc.itemTypes.find((t) => t.id === it.typeId);
    return t?.color ?? '#888';
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#16181d;font-family:system-ui,sans-serif;font-size:11px">`;

  // Ruler ticks
  const ticks = ticksFor(cb.left, cb.right, px);
  for (const t of ticks) {
    const tx = x(t.jd);
    svg += `<line x1="${tx}" y1="30" x2="${tx}" y2="${H}" stroke="#2c313b" stroke-width="0.5"/>`;
    svg += `<text x="${tx}" y="22" fill="#8b93a3" text-anchor="middle" font-size="10">${t.label}</text>`;
  }

  // Bars
  rows.forEach((r, i) => {
    const y = 40 + i * 24;
    const xa = x(r.bd.a);
    const xb = x(r.bd.b);
    const w = Math.max(3, xb - xa);
    const color = typeColor(r.it);
    svg += `<rect x="${xa}" y="${y + 5}" width="${w}" height="14" rx="3" fill="${color}" opacity="0.85"/>`;
    if (w > 26) {
      svg += `<text x="${xa + 4}" y="${y + 16}" fill="${w > 140 ? '#fff' : color}" font-size="10">${esc(r.it.label)}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

export function downloadSvg(doc: TimelineDoc, filter?: Filter): void {
  const svg = exportAsSvg(doc, filter);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (doc.name || 'timeline') + '.svg';
  a.click();
  URL.revokeObjectURL(url);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
