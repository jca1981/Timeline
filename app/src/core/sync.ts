// **** Span-sync: start ↔ duration ↔ end holdes altid matematiske konsistente (Aeon-regel) ****
import type { Duration, Precision, Span } from './types';
import { addDuration, diffDuration, negateDuration, toJD, isValidDate } from './jdn';

export interface SyncResult {
  span?: Span;
  error?: string;
}

/**
 * Regler (fra Aeon-dokumentation, revers engineering):
 * - Ret i start → varighed fastholdes, end beregnes
 * - Ret i end (eller varighed) → start fastholdes, det andet beregnes
 * - Slut før start → afvist (varighed kan ikke være negativ)
 * - ongoing → ingen fast slut/varighed
 */
export function syncSpan(next: Span): SyncResult {
  if (next.ongoing) {
    return { span: { ...next, end: undefined, duration: undefined } };
  }
  if (!next.start) {
    // dato-løst item: gem kun det brugeren har indtastet
    return { span: next };
  }
  // issue #7: kalender-ugyldige datoer (31. feb, måned 13) aafernes med dansk besked.
  // Raawerdien bevares af setSpan (gaar i errors-mappen) saa brugeren kan rette feltet.
  if (next.start && !isValidDate(next.start)) {
    return { span: next, error: 'ugyldig startdato (maaned 1-12, dag inden for maaneden)' };
  }
  if (next.end && !isValidDate(next.end)) {
    return { span: next, error: 'ugyldig slutdato (maaned 1-12, dag inden for maaneden)' };
  }
  if (next.duration && next.end) {
    // begge givet — valider konsistens
    const expected = addDuration(next.start, next.duration);
    if (Math.abs(toJD(expected) - toJD(next.end)) > 1 / 86400) {
      // recompute end fra start+duration (UI vælger felt; motoren foretrækker start+duration)
      return { span: { ...next, end: expected } };
    }
    return { span: next };
  }
  if (next.duration) {
    return { span: { ...next, end: addDuration(next.start, next.duration) } };
  }
  if (next.end) {
    if (toJD(next.end) < toJD(next.start)) {
      return { error: 'slutdato kan ikke ligge før startdato' };
    }
    return { span: { ...next, duration: diffDuration(next.start, next.end) } };
  }
  // kun start: end = start (punkthændelse)
  return { span: { ...next, end: next.start, duration: {} } };
}

/** Flyt span som helhed (bogstavelig forskydning af begge ender). */
export function shiftSpan(span: Span, delta: Duration): Span {
  const out = { ...span };
  if (out.start) out.start = addDuration(out.start, delta);
  if (out.end && !out.ongoing) out.end = addDuration(out.end, delta);
  return out;
}

export function reverseDuration(dur: Duration): Duration {
  return negateDuration(dur);
}

const ORDER: Precision[] = ['year', 'month', 'day', 'time'];

/** Items præcision = mindste signifikante enhed af start-dato + varighed (Aeon-regel). */
export function itemPrecision(span: Span): Precision {
  let p: Precision = 'time';
  if (span.start) p = span.start.precision;
  const d = span.duration;
  if (d) {
    if (d.h || d.mi || d.s) p = maxP(p, 'time');
    if (d.d) p = maxP(p, 'day');
    if (d.mo) p = maxP(p, 'month');
    if (d.y) p = maxP(p, 'year');
  }
  return p;
}

/** Aeon: visning bruger MINDSTE præcision af start og varighed. */
function maxP(a: Precision, b: Precision): Precision {
  return ORDER.indexOf(a) > ORDER.indexOf(b) ? b : a;
}

/** Parent-range-advarsel (Aeon: "Forældres tidsramme tillader ikke..." — vi advarer, blokerer ikke). */
export function rangeWarning(child: Span, parent?: Span): string | undefined {
  if (!parent?.start || !child.start) return undefined;
  const cs = toJD(child.start);
  const ce = child.end ? toJD(child.end) : cs;
  const ps = toJD(parent.start);
  const pe = parent.end ? toJD(parent.end) : ps;
  if (cs < ps - 1e-9 || ce > pe + 1e-9) {
    return 'Forældres tidsramme tillader ikke den anfordte dato';
  }
  return undefined;
}
