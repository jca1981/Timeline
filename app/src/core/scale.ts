// **** Scale: zoom-trin, tidehvervs-ticks og spænd→JD-grænser (timeline-view M2) ****
// Genbruger dato-motoren: kalender-følsomme ticks via addDuration/fromJD.
import type { Span } from './types';
import { addDuration, fromJD, negateDuration, toJD } from './jdn';
import { displayYear, formatDate, todayJD, weekdayOfJD } from './format';

export const MIN_PX_PER_DAY = 1 / 500_000; // ~0.37 px per årtusinde… (4000 f.Kr. → nu på ~2500 px)
export const MAX_PX_PER_DAY = 172_800; // 2 px per sekund
export function clampPx(px: number): number {
  return Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, px));
}

/** px/dag der faar et tidsrum [a,b] til at passe pa `width` px (fill = andel af bredden). */
export function fitPx(a: number, b: number, width: number, fill = 0.8): number {
  const span = Math.max(1, b - a);
  if (!(width > 0) || !isFinite(span)) return MIN_PX_PER_DAY;
  return clampPx((width * fill) / span);
}

// Under denne px/dag slaar timeline-view poster sammen til klynger.
export const CLUSTER_PX_PER_DAY = 0.005;

/**
 * Klik pa en klynge: zoom sa klyngens tidsrum passer - men ALDRIG sa laedt at
 * klyngen bare genskabes med det samme (vi ligger over cluster-taersklen).
 */
export function clusterFitPx(a: number, b: number, width: number): number {
  return clampPx(Math.max(fitPx(a, b, width), CLUSTER_PX_PER_DAY * 2));
}

export type Step =
  | { kind: 'time'; sec: number } // fast JD-step (sekunder)
  | { kind: 'day'; n: number } // n dage (n=7 → uger, alignet mandag)
  | { kind: 'month'; n: 1 | 2 | 3 | 6 }
  | { kind: 'year'; n: number };

const YEAR = 365.25;
const LADDER: { step: Step; days: number }[] = [
  { step: { kind: 'time', sec: 10 }, days: 10 / 86400 },
  { step: { kind: 'time', sec: 30 }, days: 30 / 86400 },
  { step: { kind: 'time', sec: 60 }, days: 1 / 1440 },
  { step: { kind: 'time', sec: 300 }, days: 5 / 1440 },
  { step: { kind: 'time', sec: 900 }, days: 15 / 1440 },
  { step: { kind: 'time', sec: 1800 }, days: 30 / 1440 },
  { step: { kind: 'time', sec: 3600 }, days: 1 / 24 },
  { step: { kind: 'time', sec: 3 * 3600 }, days: 3 / 24 },
  { step: { kind: 'time', sec: 6 * 3600 }, days: 6 / 24 },
  { step: { kind: 'time', sec: 12 * 3600 }, days: 12 / 24 },
  { step: { kind: 'day', n: 1 }, days: 1 },
  { step: { kind: 'day', n: 2 }, days: 2 },
  { step: { kind: 'day', n: 7 }, days: 7 },
  { step: { kind: 'month', n: 1 }, days: 30.44 },
  { step: { kind: 'month', n: 2 }, days: 60.9 },
  { step: { kind: 'month', n: 3 }, days: 91.3 },
  { step: { kind: 'month', n: 6 }, days: 182.6 },
  { step: { kind: 'year', n: 1 }, days: YEAR },
  { step: { kind: 'year', n: 2 }, days: 2 * YEAR },
  { step: { kind: 'year', n: 5 }, days: 5 * YEAR },
  { step: { kind: 'year', n: 10 }, days: 10 * YEAR },
  { step: { kind: 'year', n: 20 }, days: 20 * YEAR },
  { step: { kind: 'year', n: 50 }, days: 50 * YEAR },
  { step: { kind: 'year', n: 100 }, days: 100 * YEAR },
  { step: { kind: 'year', n: 200 }, days: 200 * YEAR },
  { step: { kind: 'year', n: 500 }, days: 500 * YEAR },
  { step: { kind: 'year', n: 1000 }, days: 1000 * YEAR },
  { step: { kind: 'year', n: 2000 }, days: 2000 * YEAR },
  { step: { kind: 'year', n: 5000 }, days: 5000 * YEAR },
];

/** Største trin der overholder mindst ~minPx px mellem stregen. */
export function pickStep(pxPerDay: number, minPx = 90): Step {
  const daysPerTick = minPx / pxPerDay;
  let best = LADDER[LADDER.length - 1];
  for (const c of LADDER) {
    if (c.days <= daysPerTick) best = c;
    else break;
  }
  return best.step;
}

export function stepLabel(step: Step): string {
  switch (step.kind) {
    case 'time':
      return step.sec < 60 ? `${step.sec} sek` : step.sec < 3600 ? `${step.sec / 60} min` : `${step.sec / 3600} timer`;
    case 'day':
      return step.n === 7 ? 'uger' : step.n === 1 ? 'dage' : `${step.n} dage`;
    case 'month':
      return step.n === 1 ? 'måneder' : step.n === 2 ? '2 mdr' : step.n === 3 ? 'kvartaler' : 'halvår';
    case 'year':
      return step.n === 1 ? 'år' : step.n < 1000 ? `${step.n} år` : `${step.n / 1000} årtusinder`;
  }
}

export interface Tick {
  jd: number;
  label: string;
}

/** Genererer læsbare, kalender-følgelige ticks over for [left,right]. */
export function ticksFor(left: number, right: number, pxPerDay: number): Tick[] {
  const step = pickStep(pxPerDay);
  const out: Tick[] = [];
  const cap = 400; // sikkerhed mod uendelige løkker
  if (step.kind === 'time' || (step.kind === 'day' && step.n < 7)) {
    const jdStep = step.kind === 'time' ? step.sec / 86400 : step.n;
    let jd = Math.ceil(left / jdStep) * jdStep;
    while (jd <= right && out.length < cap) {
      const dv = fromJD(jd, 'time');
      const midnight = Math.abs(jd + 0.5 - Math.round(jd + 0.5)) < 1e-6;
      const label = midnight ? `${dv.d}. ${monthShort(dv.mo!)} ${displayYear(dv.y)}` : `kl. ${pad(dv.h!)}:${pad(dv.mi!)}`;
      out.push({ jd, label });
      jd += jdStep;
    }
  } else if (step.kind === 'day' && step.n === 7) {
    // uger: align til mandag
    let dv = fromJD(left, 'day');
    let jd = toJD(dv);
    jd -= ((weekdayOfJD(jd) + 7) % 7);
    while (jd < left) jd += 7;
    while (jd <= right && out.length < cap) {
      const d = fromJD(jd, 'day');
      out.push({ jd, label: `${d.d}. ${monthShort(d.mo!)} ${displayYear(d.y)}` });
      jd += 7;
    }
  } else {
    // måned/år: iterér kalenderen (præcist på tværs af BC/AD og skudår)
    const kind = step.kind;
    const n = step.n;
    let dv = fromJD(left, kind === 'month' ? 'month' : 'year');
    if (kind === 'month') {
      const allowed = n === 1 ? null : n === 2 ? [1, 3, 5, 7, 9, 11] : n === 3 ? [1, 4, 7, 10] : [1, 7];
      while (allowed && !allowed!.includes(dv.mo!)) dv = addDuration(dv, { mo: 1 });
      if (toJD(dv) < left) dv = addDuration(dv, { mo: n });
    } else {
      const mod = ((dv.y % n) + n) % n;
      if (mod !== 0) dv = { y: dv.y + (n - mod), precision: 'year' };
      if (toJD(dv) < left) dv = { y: dv.y + n, precision: 'year' };
    }
    while (toJD(dv) <= right && out.length < cap) {
      out.push({ jd: toJD(dv), label: formatDate(dv) });
      dv = addDuration(dv, kind === 'month' ? { mo: n } : { y: n });
    }
  }
  return out;
}

const SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function monthShort(mo: number): string {
  return SHORT[mo - 1];
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**JD-grænser for en spænd: solid bjælke [a,b] + usikkerheds-halo [ua,ub]. */
export interface Bounds {
  a: number;
  b: number;
  ua?: number;
  ub?: number;
}

export function spanBounds(span: Span): Bounds | undefined {
  const sJD = span.start ? toJD(span.start) : undefined;
  let a: number | undefined = sJD;
  let b: number | undefined = span.end ? toJD(span.end) : undefined;

  if (a === undefined && b === undefined) return undefined; // helt uden dato → uden for timeline
  if (span.ongoing) {
    if (a === undefined) return undefined;
    b = Math.max(todayJD(), a);
  }
  if (b === undefined && a !== undefined) {
    if (span.duration) b = toJD(addDuration(span.start!, span.duration));
    else b = a; // punkt
  }
  if (a === undefined && b !== undefined) {
    if (span.duration) a = toJD(addDuration(span.end!, negateDuration(span.duration))); // slut - varighed (kalender-følsomt)
    else a = b; // punkt
  }
  const bounds: Bounds = { a: a!, b: Math.max(b!, a!) };
  if (span.uncertain?.latestStart) bounds.ua = Math.max(toJD(span.uncertain.latestStart), bounds.a);
  if (span.uncertain?.earliestEnd) bounds.ub = Math.min(toJD(span.uncertain.earliestEnd), bounds.b);
  return bounds;
}

/** Samlet indholdshak (til "tilpas efter indhold"). */
export function contentBounds(spans: Span[]): { left: number; right: number } | undefined {
  let left = Infinity;
  let right = -Infinity;
  for (const s of spans) {
    const bd = spanBounds(s);
    if (!bd) continue;
    left = Math.min(left, bd.a, bd.ua ?? Infinity);
    right = Math.max(right, bd.b, bd.ub ?? -Infinity);
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
  if (right - left < 1) {
    left -= 2;
    right += 2; // enkeltspænd → giv luft
  }
  return { left, right };
}
