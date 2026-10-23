// **** Formatering: dansk, f.Kr./e.Kr., inklusiv-visning, usikkerhed, relative styles ****
import type { DateStyle, DateValue, Precision, Span } from './types';
import { atMidnight, fromJD, toJD, DAY, resolve } from './jdn';

const MONTHS = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
// Ugedage indexeret som JDN % 7 (JDN 0 var en mandag)
const WEEKDAYS = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'];

export function displayYear(y: number): string {
  return y < 1 ? `${1 - y} f.Kr.` : `${y}`;
}

function two(n: number): string { return String(n).padStart(2, '0'); }

/** Overlad præcision på en dato: finere → udfyld standarder; grovere → truncér. */
function shownAs(dv: DateValue, p: Precision): DateValue {
  const r = resolve(dv);
  const out: DateValue = { precision: p, y: r.y };
  if (p !== 'year') out.mo = r.mo;
  if (p === 'day' || p === 'time') out.d = r.d;
  if (p === 'time') { out.h = r.h; out.mi = r.mi; out.s = r.s; }
  return out;
}

/** Formatér én dato (absolut eller relativ stil). */
export function formatDate(dv: DateValue, style: DateStyle = { kind: 'absolute' }): string {
  if (style.kind === 'relative') return formatRelative(dv, style);
  const date = (p: Precision) => `${dv.d}. ${MONTHS[(dv.mo ?? 1) - 1]} ${displayYear(dv.y)}${p === 'time' && dv.h !== undefined ? ` kl. ${two(dv.h ?? 0)}:${two(dv.mi ?? 0)}` : ''}`;
  switch (dv.precision) {
    case 'year': return displayYear(dv.y);
    case 'month': return `${MONTHS[(dv.mo ?? 1) - 1]} ${displayYear(dv.y)}`;
    case 'day': return date('day');
    case 'time': return date('time');
  }
}

function formatRelative(dv: DateValue, style: Extract<DateStyle, { kind: 'relative' }>): string {
  const zeroJD = toJD(style.zero);
  const diff = toJD(dv) - zeroJD;
  const sign = diff < 0 ? '-' : '';
  const abs = Math.abs(diff);
  switch (style.unit) {
    case 'day': {
      const days = Math.floor(abs + 1e-9);
      const frac = abs - days;
      let out = `${sign}Dag ${days}`;
      if (dv.precision === 'time' && frac > 1e-9) out += ` kl. ${fracToTime(frac)}`;
      return out;
    }
    case 'week': {
      const days = Math.floor(abs + 1e-9);
      const weeks = Math.floor(days / 7);
      const zeroDow = ((Math.floor(zeroJD + 0.5) % 7) + 7) % 7;
      const dow = WEEKDAYS[(zeroDow + (days % 7)) % 7];
      let out = `${sign}Uge ${weeks}, ${dow}`;
      if (dv.precision === 'time') out += ` kl. ${two(dv.h ?? 0)}:${two(dv.mi ?? 0)}`;
      return out;
    }
    case 'time': {
      const secs = Math.round(abs * 86400);
      const h = Math.floor(secs / 3600), mi = Math.floor((secs % 3600) / 60), s = secs % 60;
      return `${sign}${two(h)}:${two(mi)}${s ? ':' + two(s) : ''}`;
    }
  }
}

function fracToTime(frac: number): string {
  const secs = Math.round(frac * 86400) % 86400;
  return `${two(Math.floor(secs / 3600))}:${two(Math.floor((secs % 3600) / 60))}`;
}

/**
 * Inklusiv visning (Aeon-regel): "start 2021 + 2 år" → "2021 – 2022" (aldrig 2023).
 * Internt er `end` et eksklusivt øjeblik; rammer det præcis midnat vises forrige dag
 * (henholdsvis "kl. 24:00" ved tidspræcision).
 * Vished om præcision = MINDSTE af start-dato og varighed (itemPrecision) — kan overrides.
 * Eksempler: "2012 – 2014", "januar – februar 2021", "8 f.Kr. – 21", usikker = "ca. …".
 */
export function formatSpan(span: Span, style: DateStyle = { kind: 'absolute' }, precision?: Precision): string {
  if (span.ongoing && span.start) {
    const dp = precision ?? span.start.precision;
    return `${formatDate(shownAs(span.start, dp), style)} – nutid`;
  }
  if (!span.start) {
    if (!span.end) return span.duration ? '(uden dato)' : '';
    const dp = precision ?? span.end.precision;
    return `… – ${formatDate(shownAs(span.end, dp), style)}`;
  }
  if (!span.end || toJD(span.end) <= toJD(span.start)) {
    return formatDate(span.start, style);
  }
  const prefix = span.uncertain ? 'ca. ' : '';
  const midnight = atMidnight(toJD(span.end));
  const endAdj = midnight ? fromJD(toJD(span.end) - DAY, 'time') : span.end;
  const dp = precision ?? autoPrecision(span.start, endAdj);
  let endStr: string;
  if (midnight && dp === 'time' && span.start.precision === 'time') {
    const dayBefore = fromJD(toJD(span.end) - DAY, 'day');
    endStr = `${dayBefore.d}. ${MONTHS[dayBefore.mo! - 1]} ${displayYear(dayBefore.y)} kl. 24:00`;
  } else {
    endStr = formatDate(shownAs(endAdj, dp), style);
  }
  return prefix + joinRange(formatDate(shownAs(span.start, dp), style), endStr);
}

/**
 * Automatisk visningspræcision for et interval: start i datoens egen præcision,
 * gå finere indtil start og (inklusiv) slut kan skelnes — Aeon: "2021 + 2 mdr" → "januar – februar 2021".
 */
function autoPrecision(start: DateValue, endInclusive: DateValue): Precision {
  const steps: Precision[] = ['year', 'month', 'day', 'time'];
  const from = steps.indexOf(start.precision);
  for (const p of steps.slice(from)) {
    if (formatDate(shownAs(start, p)) !== formatDate(shownAs(endInclusive, p))) return p;
  }
  return 'time';
}

/** "2012 – 2014" → "2012 – 2014"; "januar 2021"+"februar 2021" → "januar – februar 2021". */
function joinRange(a: string, b: string): string {
  const ai = a.lastIndexOf(' ');
  const bi = b.lastIndexOf(' ');
  if (ai > 0 && bi > 0 && a.slice(ai) === b.slice(bi) && !a.includes('f.Kr.') && !b.includes('f.Kr.')) {
    return `${a.slice(0, ai)} – ${b}`;
  }
  return `${a} – ${b}`;
}

/** Usikkerhedsrække (tooltip): "start senest …, slut tidligst …". */
export function formatUncertainty(span: Span, style: DateStyle = { kind: 'absolute' }): string | undefined {
  if (!span.uncertain) return undefined;
  const { latestStart, earliestEnd } = span.uncertain;
  const parts: string[] = [];
  if (latestStart) parts.push(`start senest ${formatDate(latestStart, style)}`);
  if (earliestEnd) parts.push(`slut tidligst ${formatDate(earliestEnd, style)}`);
  return parts.join(', ');
}

/** Alder ved tidspunkt (Aeon "Show Item Ages"): "29 år" — brugt i bibel/slægt-views. */
export function ageAt(birth: DateValue, atJD: number): string {
  if (atJD < toJD(birth)) return '(før fødsel)';
  const at = fromJD(atJD, 'day');
  let years = at.y - birth.y;
  const bm = birth.mo ?? 1, bd = birth.d ?? 1;
  const am = at.mo ?? 1, ad = at.d ?? 1;
  if (am < bm || (am === bm && ad < bd)) years--;
  return years >= 0 ? `${years} år` : '(før fødsel)';
}

/**Aktuel dato som JD (til ongoing-tekst m.m.). */
export function todayJD(): number {
  const now = new Date();
  return toJD({ y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), mi: now.getMinutes(), s: now.getSeconds(), precision: 'time' });
}

/** Ugedag for et JD-øjeblik (0=mandag … 6=søndag). */
export function weekdayOfJD(jd: number): number {
  return ((Math.floor(jd + 0.5) % 7) + 7) % 7;
}
