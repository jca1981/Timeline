// **** Farve-hjælpe: sikrer læselig tekst på farvede bjælker/chips (WCAG-kontrast) ****
// Lært af brugerrapport: gylden bjælke (#d9a441) med hvid tekst ≈ 1.9:1 = ulæselig.

/** Mørk panelbaggrund (svarer til --panel i index.css). */
export const PANEL_BG = '#232830';

const DARK_TEXT = '#11141a';
const LIGHT_TEXT = '#ffffff';

export interface Readable { color: string; shadow: string }

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Gængse CSS-farvenavne. Importerede .aeon-filer gemmer ofte navne i stedet for
 * hex (`yellow`, `orange`, `red`) - uden denne tabel falder kontrastberegningen
 * tilbage til hvid tekst, som paa gylden/nettop gul er uaeselig (1,9:1).
 */
const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', gold: '#ffd700', teal: '#008080',
  navy: '#000080', olive: '#808000', lime: '#00ff00', maroon: '#800000', aqua: '#00ffff',
  cyan: '#00ffff', magenta: '#ff00ff', violet: '#ee82ee', indigo: '#4b0082', crimson: '#dc143c',
  salmon: '#fa8072', khaki: '#f0e68c', tan: '#d2b48c', beige: '#f5f5dc', ivory: '#fffff0',
  coral: '#ff7f50', orchid: '#da70d6', turquoise: '#40e0d0', skyblue: '#87ceeb',
  lightblue: '#add8e6', lightgreen: '#90ee90', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  darkgray: '#a9a9a9', darkgrey: '#a9a9a9', darkblue: '#00008b', darkgreen: '#006400',
  darkred: '#8b0000', darkorange: '#ff8c00', darkviolet: '#9400d3', steelblue: '#4682b4',
  slateblue: '#6a5acd', royalblue: '#4169e1', firebrick: '#b22222', forestgreen: '#228b22',
  seagreen: '#2e8b57', yellowgreen: '#9acd32', plum: '#dda0dd', lavender: '#e6e6fa',
  wheat: '#f5deb3', goldenrod: '#daa520', darkgoldenrod: '#b8860b', peru: '#cd853f',
  chocolate: '#d2691e', sienna: '#a0522d', hotpink: '#ff69b4', deeppink: '#ff1493',
  deepskyblue: '#00bfff', dodgerblue: '#1e90ff', cornflowerblue: '#6495ed', mediumseagreen: '#3cb371',
};

/** #rgb / #rrggbb eller gængs CSS-farvenavn → [r,g,b]. Kaster ved ugyldig vaerdi. */
export function parseHex(hex: string): [number, number, number] {
  const raw = String(hex ?? '').trim();
  const v = (NAMED[raw.toLowerCase()] || raw).trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!m) throw new Error(`ugyldig farve: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function isColor(value: unknown): value is string {
  try {
    parseHex(String(value));
    return true;
  } catch {
    return false;
  }
}

function channelLin(c8: number): number {
  const v = c8 / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relativ luminans (0..1). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channelLin(r) + 0.7152 * channelLin(g) + 0.0722 * channelLin(b);
}

/** WCAG kontrastforhold (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHex(n: number): string {
  return Math.round(clamp01(n / 100) * 255).toString(16).padStart(2, '0');
}

function rgbToHsl(hex: string): [number, number, number] {
  const [r8, g8, b8] = parseHex(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp01(s / 100);
  const ll = clamp01(l / 100);
  const hue2 = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r = ll, g = ll, b = ll;
  if (ss !== 0) {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2(p, q, hh + 1 / 3);
    g = hue2(p, q, hh);
    b = hue2(p, q, hh - 1 / 3);
  }
  return `#${toHex(r * 100)}${toHex(g * 100)}${toHex(b * 100)}`;
}

/**
 * Læselig tekstfarve PÅ en baggrundsfarve (fx tekst inde i en farvet bjælke).
 * Valger mørk eller hvid efter WCAG-kontrast, plus passende tekstskygge.
 */
export function textColorFor(bg: string | undefined): Readable {
  if (!isColor(bg)) return { color: LIGHT_TEXT, shadow: `rgba(0,0,0,0.55) 0 1px 2px` };
  const lightIsBetter = contrastRatio(LIGHT_TEXT, bg!) >= contrastRatio(DARK_TEXT, bg!);
  return lightIsBetter
    ? { color: LIGHT_TEXT, shadow: `rgba(0,0,0,0.55) 0 1px 2px` }
    : { color: DARK_TEXT, shadow: `rgba(255,255,255,0.35) 0 1px 2px` };
}

/**
 * Justerer en tekstfarves lysstyrke (hue/mætning bevaret) indtil den når
 * `min` kontrast mod baggrunden. Ugyldige værdier returneres uændret.
 */
export function readableOn(fg: string | undefined, bg = PANEL_BG, min = 4.5): string {
  if (!isColor(fg)) return String(fg ?? '');
  const base = fg!;
  if (contrastRatio(base, bg) >= min) return base;
  const [h, s, l0] = rgbToHsl(base);
  const goLighter = luminance(bg) < 0.5; // mørk baggrund → lys tekst
  const step = goLighter ? 3 : -3;
  let l = l0;
  for (let i = 0; i < 40; i++) {
    l += step;
    if (l < 2 || l > 98) break;
    const cand = hslToHex(h, s, l);
    if (contrastRatio(cand, bg) >= min) return cand;
  }
  // kunne ikke nå målet (fx for mættet) → vælg den reneste kontrastfarve vi ramte
  return goLighter ? hslToHex(h, Math.min(s, 25), Math.min(96, Math.max(l, 88))) : hslToHex(h, Math.min(s, 25), Math.max(4, Math.min(l, 12)));
}
