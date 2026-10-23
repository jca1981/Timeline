// **** JDN-aritmetik: proleptisk gregoriansk, astronomisk årstal (1 f.Kr. = 0) ****
// Internt bruges Julian Day Number (float) for sammenligning/zoom — virker fra 4000 f.Kr. → fremtid.
import type { DateValue, Duration, Precision } from './types';

export const DAY = 1; // JD-enhed = 1 døgn
const SEC = 1 / 86400;

/** Gammelt, velkendt algoritme (Meeus); virker for negative år i astronomisk notation. */
export function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): { y: number; mo: number; d: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d0 = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d0) / 4);
  const m0 = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m0 + 2) / 5) + 1;
  const mo = m0 + 3 - 12 * Math.floor(m0 / 10);
  const y = 100 * b + d0 - 4800 + Math.floor(m0 / 10);
  return { y, mo, d: day };
}

export function isLeapYear(y: number): boolean {
  // divisibilitet virker med negative år i JS (-400 % 400 === 0)
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

export function daysInMonth(y: number, mo: number): number {
  const dim = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dim[mo - 1];
}

/** Udfyld manglende komponenter til det øjeblik datoen repræsenterer (start af periode). */
export function resolve(dv: DateValue): Required<Omit<DateValue, 'precision'>> & { precision: Precision } {
  return {
    y: dv.y, mo: dv.mo ?? 1, d: dv.d ?? 1,
    h: dv.h ?? 0, mi: dv.mi ?? 0, s: dv.s ?? 0,
    precision: dv.precision,
  };
}

/** JD for datoa's øjeblik (dagstart hvis ingen tid). */
export function toJD(dv: DateValue): number {
  const r = resolve(dv);
  const noonJDN = gregorianToJDN(r.y, r.mo, r.d);
  return noonJDN - 0.5 + (r.h * 3600 + r.mi * 60 + r.s) * SEC;
}

/** Tilbage til DateValue med ønsket præcision. */
export function fromJD(jd: number, precision: Precision = 'time'): DateValue {
  const dayInt = Math.floor(jd + 0.5);
  let frac = jd + 0.5 - dayInt; // andel af døgn siden.midnat
  if (frac < 0) frac += 1;
  const g = jdnToGregorian(dayInt);
  const secs = Math.round(frac * 86400) % 86400;
  const dv: DateValue = { y: g.y, precision };
  if (precision !== 'year') dv.mo = g.mo;
  if (precision !== 'year' && precision !== 'month') dv.d = g.d;
  if (precision === 'time') {
    dv.h = Math.floor(secs / 3600);
    dv.mi = Math.floor((secs % 3600) / 60);
    dv.s = secs % 60;
  }
  return dv;
}

export function atMidnight(jd: number): boolean {
  const frac = jd + 0.5 - Math.floor(jd + 0.5);
  return Math.abs(((frac % 1) + 1) % 1) < SEC * 2;
}

/** Kalender-følsom addition (år/måneders lengths respekteres). */
export function addDuration(dv: DateValue, dur: Duration): DateValue {
  const r = resolve(dv);
  let y = r.y + (dur.y ?? 0);
  let mo = r.mo - 1 + (dur.mo ?? 0);
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12 + 1;
  let d = r.d;
  let y2 = y;
  if (mo !== r.mo) {
    let target = ((mo % 12) + 12) % 12;
    if (target === 0) target = 12;
    d = Math.min(d, daysInMonth(y2, target)); // clamp: 31. jan +1 md → 28. feb
  }
  let h = r.h + (dur.h ?? 0);
  let mi = r.mi + (dur.mi ?? 0);
  let s = r.s + (dur.s ?? 0);
  // normér tid → ekstra dage
  let extraDays = 0;
  if (s >= 60 || s < 0) { extraDays += Math.floor(s / 60); s = ((s % 60) + 60) % 60; }
  if (mi >= 60 || mi < 0) { extraDays += Math.floor(mi / 60); mi = ((mi % 60) + 60) % 60; }
  if (h >= 24 || h < 0) { extraDays += Math.floor(h / 24); h = ((h % 24) + 24) % 24; }
  const jdResult = gregorianToJDN(y2, mo, d) + (dur.d ?? 0) + extraDays;
  const g = jdnToGregorian(Math.floor(jdResult) + (jdResult % 1 >= 0.5 ? 1 : 0));
  return { y: g.y, mo: g.mo, d: g.d, h, mi, s, precision: dv.precision };
}

export function negateDuration(dur: Duration): Duration {
  const out: Duration = {};
  for (const k of ['y', 'mo', 'd', 'h', 'mi', 's'] as const) {
    if (dur[k] !== undefined) out[k] = -dur[k]!;
  }
  return out;
}

export function addJD(dv: DateValue, jdDelta: number, precision: Precision): DateValue {
  return fromJD(toJD(dv) + jdDelta, precision);
}

/** Tjek om dato er reel (fx ikke 31. februar). */
export function isValidDate(dv: DateValue): boolean {
  const r = resolve(dv);
  if (r.mo < 1 || r.mo > 12) return false;
  if (r.d < 1 || r.d > daysInMonth(r.y, r.mo)) return false;
  return r.h >= 0 && r.h <= 23 && r.mi >= 0 && r.mi <= 59 && r.s >= 0 && r.s <= 59;
}

/** Kalender-følsom differende: find varigheden start→slut (ca., lån korrekst hvor muligt). */
export function diffDuration(start: DateValue, end: DateValue): Duration {
  let a = resolve(start);
  let b = resolve(end);
  if (toJD(end) < toJD(start)) throw new Error('varighed kan ikke være negativ');
  let y = b.y - a.y, mo = b.mo - a.mo, d = b.d - a.d;
  let h = b.h - a.h, mi = b.mi - a.mi, s = b.s - a.s;
  if (s < 0) { s += 60; mi--; }
  if (mi < 0) { mi += 60; h--; }
  if (h < 0) { h += 24; d--; }
  if (d < 0) {
    mo--;
    const pm = b.mo === 1 ? 12 : b.mo - 1; // lån fra måneden før SLUT
    const py = b.mo === 1 ? b.y - 1 : b.y;
    d += daysInMonth(py, pm);
  }
  if (mo < 0) { mo += 12; y--; }
  const dur: Duration = {};
  if (y) dur.y = y;
  if (mo) dur.mo = mo;
  if (d) dur.d = d;
  if (h) dur.h = h;
  if (mi) dur.mi = mi;
  if (s) dur.s = s;
  return dur;
}
