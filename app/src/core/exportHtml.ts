// **** HTML-eksport (M14): standalone statisk tidslinje som HTML-fil ****
import type { TimelineDoc, Item } from '../model/doc';
import { spanBounds } from './scale';
import { contentBounds } from './scale';
import { textColorFor, readableOn } from './color';

/**
 * Generates a self-contained HTML file with a static SVG timeline.
 * No JS needed – pure SVG + inline CSS.
 */
export function exportAsHtml(doc: TimelineDoc, filter?: (it: Item) => boolean): string {
  const items = (filter ? doc.items.filter(filter) : doc.items)
    .map((it) => ({ it, bd: spanBounds(it.span) }))
    .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
    .sort((a, b) => a.bd.a - b.bd.a);

  const cb = contentBounds(items.map((r) => r.it.span));
  if (!cb) return '<html><body><p>Tomt dokument.</p></body></html>';

  const W = 1400;
  const PAD = 40;
  const innerW = W - PAD * 2;
  const JD_RANGE = cb.right - cb.left || 1;
  const px = (jd: number) => PAD + ((jd - cb.left) / JD_RANGE) * innerW;

  // Era bands
  const childrenMap = new Map<string, string[]>();
  for (const it of doc.items) {
    if (it.parentId) {
      const arr = childrenMap.get(it.parentId) ?? [];
      arr.push(it.id);
      childrenMap.set(it.parentId, arr);
    }
  }
  const eras = doc.items.filter((it) => {
    const kids = childrenMap.get(it.id);
    if (!kids || kids.length < 3) return false;
    const bd = spanBounds(it.span);
    return bd && bd.b - bd.a > 18250;
  });

  const ROW_H = 22;
  const H = items.length * ROW_H + 60;

  // Sikkerhed: etiketter/navne/farver kan komme fra importerte .aeon-filer og må ikke kunne
  // injicere markup i den eksporterede, selvstaendige HTML-fil.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attr = (s: string) => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // hex eller gængst CSS-navn (kun bogstaver -ingen anfoerselstegn/koder, saa det er sikkert i SVG/HTML)
  const safeColor = (c: string | undefined) => (c && (/^#[0-9a-fA-F]{3,8}$/.test(c) || /^[a-zA-Z]+$/.test(c)) ? c : '#888');

  const eraSvgs = eras.map((it) => {
    const bd = spanBounds(it.span)!;
    const type = doc.itemTypes.find((t) => t.id === it.typeId);
    const color = safeColor(it.color ?? type?.color);
    return `<rect x="${px(bd.a)}" y="30" width="${px(bd.b) - px(bd.a)}" height="${H - 60}" fill="${color}" opacity="0.05" /><text x="${px(bd.a) + 4}" y="42" font-size="9" fill="${readableOn(color, '#1a1d23')}" opacity="0.9">${esc(it.label)}</text>`;
  }).join('\n');

  const rowsSvg = items.map(({ it, bd }, i) => {
    const type = doc.itemTypes.find((t) => t.id === it.typeId);
    const color = safeColor(it.color ?? type?.color);
    const xa = px(bd.a);
    const w = Math.max(3, px(bd.b) - xa);
    const y = 40 + i * ROW_H;
    return `<rect x="${xa}" y="${y + 4}" width="${w}" height="${14}" rx="3" fill="${color}" /><text x="${xa + (w > 100 ? 4 : w + 4)}" y="${y + 14}" font-size="10" fill="${w > 100 ? textColorFor(color).color : readableOn(color, '#1a1d23')}">${esc(it.label)}</text>`;
  }).join('\n');

  // Dateless count
  const datelessCount = doc.items.length - items.length;

  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8" />
<title>${attr(doc.name || 'Timeline')}</title>
<style>
body { margin: 20px; background: #1a1d23; color: #eee; font-family: system-ui, sans-serif; }
h1 { font-size: 18px; }
.meta { font-size: 12px; opacity: 0.6; }
svg { width: 100%; max-width: ${W}px; display: block; margin-top: 10px; }
</style>
</head>
<body>
<h1>📜 ${attr(doc.name || 'Timeline')}</h1>
<p class="meta">${items.length} daterede poster${datelessCount > 0 ? ` (${datelessCount} uden dato)` : ''} · Genereret ${new Date().toLocaleDateString('da')}</p>
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="#0d0f13" rx="6"/>
${eraSvgs}
${rowsSvg}
</svg>
</body>
</html>`;
}

/** Trigger browser download of exported HTML. */
export function downloadHtml(doc: TimelineDoc) {
  const html = exportAsHtml(doc);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(doc.name || 'timeline').replace(/[^a-zA-Z0-9._-]/g, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
