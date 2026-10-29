// **** Golden-tests for dato-motoren — expects kommer fra Aeon's egen dokumentation ****
import { describe, it, expect } from 'vitest';
import {
  gregorianToJDN, jdnToGregorian, toJD, fromJD, addDuration, diffDuration,
  daysInMonth, isValidDate, atMidnight,
} from './jdn';
import { syncSpan, rangeWarning, itemPrecision } from './sync';
import { displayYear, formatDate, formatSpan, ageAt } from './format';
import type { DateValue, Span } from './types';

const Y = (y: number): DateValue => ({ y, precision: 'year' });
const YM = (y: number, mo: number): DateValue => ({ y, mo, precision: 'month' });
const YMD = (y: number, mo: number, d: number): DateValue => ({ y, mo, d, precision: 'day' });
const T = (y: number, mo: number, d: number, h: number, mi = 0): DateValue =>
  ({ y, mo, d, h, mi, s: 0, precision: 'time' });

describe('JDN-grundlag (proleptisk gregoriansk, astronomisk årstal)', () => {
  it('kendt anker: 1. jan 2000 = JDN 2451545', () => {
    expect(gregorianToJDN(2000, 1, 1)).toBe(2451545);
  });
  it('år 1 e.Kr. = JDN 1721426 (proleptisk gregoriansk)', () => {
    expect(gregorianToJDN(1, 1, 1)).toBe(1721426);
  });
  it('1 f.Kr. = astronomisk år 0 — vedvarende fortløb over skel', () => {
    expect(toJD(YMD(0, 12, 31)) + 1).toBe(toJD(YMD(1, 1, 1))); // 31 dec 1 f.Kr. + 1 dag = 1 jan 1 e.Kr.
  });
  it('rundtur JD→dato også for lang fortid (bibel-tidspunkt)', () => {
    const d = YMD(-3999, 1, 1); // 4000 f.Kr.
    expect(jdnToGregorian(gregorianToJDN(-3999, 1, 1))).toEqual({ y: -3999, mo: 1, d: 1 });
    expect(fromJD(toJD(d), 'day')).toMatchObject({ y: -3999, mo: 1, d: 1 });
  });
  it('skudår: år 0 (=1 f.Kr.) er skudår i proleptisk gregoriansk', () => {
    expect(daysInMonth(0, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(-4, 2)).toBe(29);
  });
  it('afviser umulige datoer', () => {
    expect(isValidDate(YMD(2021, 2, 31))).toBe(false);
    expect(isValidDate(YM(2021, 13))).toBe(false);
    expect(isValidDate(YMD(2024, 2, 29))).toBe(true);
  });
});

describe("Inklusiv fortolkning (Aeon's hemmelige sauce)", () => {
  it('start 2021 + 2 år → "2021 – 2022" (internt slut 1. jan 2023)', () => {
    const start = Y(2021);
    const span: Span = { start, duration: { y: 2 }, end: addDuration(start, { y: 2 }) };
    expect(toJD(span.end!)).toBe(toJD(YMD(2023, 1, 1)));
    expect(formatSpan(span)).toBe('2021 – 2022');
  });
  it('start 2012 + 3 år → "2012 – 2014" (dok-eksempel)', () => {
    const start = Y(2012);
    const span: Span = { start, duration: { y: 3 }, end: addDuration(start, { y: 3 }) };
    expect(formatSpan(span)).toBe('2012 – 2014');
  });
  it('start 2021 + 2 måneder → "januar – februar 2021" (dok-eksempel)', () => {
    const start = Y(2021);
    const span: Span = { start, duration: { mo: 2 }, end: addDuration(start, { mo: 2 }) };
    expect(formatSpan(span)).toBe('januar – februar 2021');
  });
  it('start 1. jan 2021 + 3 dage → "1. januar – 3. januar 2021" (dok-eksempel)', () => {
    const start = YMD(2021, 1, 1);
    const span: Span = { start, duration: { d: 3 }, end: addDuration(start, { d: 3 }) };
    expect(formatSpan(span)).toBe('1. januar – 3. januar 2021');
  });
  it('tid: start 10:00 + 2d14t → slutter ved midnat → "... kl. 24:03"?? nej: 24:00 (dok)', () => {
    const start = T(2021, 1, 1, 10);
    const span: Span = { start, duration: { d: 2, h: 14 }, end: addDuration(start, { d: 2, h: 14 }) };
    expect(atMidnight(toJD(span.end!))).toBe(true);
    expect(formatSpan(span)).toBe('1. januar 2021 kl. 10:00 – 3. januar 2021 kl. 24:00');
  });
  it('år + måneder: varighed-months gør ikke visningen finer end nødvendigt (2 år → år)', () => {
    expect(itemPrecision({ start: Y(2021), duration: { mo: 2 } })).toBe('year');
    expect(itemPrecision({ start: T(2021, 1, 1, 10), duration: { y: 1 } })).toBe('year');
  });
});

describe('f.Kr./e.Kr. (bibel-kronologi)', () => {
  it('displayYear: -7 → "8 f.Kr.", 1 → "1", 0 → "1 f.Kr."', () => {
    expect(displayYear(-7)).toBe('8 f.Kr.');
    expect(displayYear(1)).toBe('1');
    expect(displayYear(0)).toBe('1 f.Kr.');
  });
  it("Jesus' liv: 4 f.Kr. + 33 år → '4 f.Kr. – 29'", () => {
    const start: DateValue = { y: -3, precision: 'year' }; // 4 f.Kr. = astronomisk -3
    const span: Span = { start, duration: { y: 33 }, end: addDuration(start, { y: 33 }) };
    expect(formatSpan(span)).toBe('4 f.Kr. – 29');
  });
  it('formatDato på dansk med f.Kr.: 24. maj 8 f.Kr.', () => {
    expect(formatDate({ y: -7, mo: 5, d: 24, precision: 'day' })).toBe('24. maj 8 f.Kr.');
  });
  it('alder ved begivenhed: født april 4 f.Kr. → 15. jan 26 = 28 år, 15. maj 26 = 29 år', () => {
    const birth: DateValue = { y: -3, mo: 4, d: 1, precision: 'day' }; // antag april 4 f.Kr.
    expect(ageAt(birth, toJD(YMD(26, 1, 15)))).toBe('28 år');
    expect(ageAt(birth, toJD(YMD(26, 5, 15)))).toBe('29 år');
    expect(ageAt(birth, toJD(YMD(-4, 1, 1)))).toBe('(før fødsel)');
  });
});

describe('Span-sync (start↔varighed↔slut altid i sync)', () => {
  it('ret i start → varighed fastholdes, slut beregnes', () => {
    const r = syncSpan({ start: Y(2024), duration: { y: 2 } });
    expect(r.error).toBeUndefined();
    expect(toJD(r.span!.end!)).toBe(toJD(YMD(2026, 1, 1)));
  });
  it('ret i slut → varighed beregnes', () => {
    const r = syncSpan({ start: YMD(2021, 1, 1), end: YMD(2021, 1, 31) });
    expect(r.span!.duration).toEqual({ d: 30 });
  });
  it('slut før start → afvist', () => {
    const r = syncSpan({ start: Y(2021), end: Y(2019) });
    expect(r.error).toMatch(/kan ikke ligge før/);
  });
  it('ongoing → ingen fast slut/varighed, vises som "– nutid"', () => {
    const r = syncSpan({ start: Y(2020), ongoing: true, end: Y(2019), duration: { y: 1 } });
    expect(r.span!.end).toBeUndefined();
    expect(formatSpan(r.span!)).toBe('2020 – nutid');
  });
  it('punkthændelse (kun start) → kun start vises', () => {
    const r = syncSpan({ start: YMD(2021, 5, 4) });
    expect(formatSpan(r.span!)).toBe('4. maj 2021');
  });
  it('diffDuration+rundtur: 31. jan +1mdr → 28. feb; differende = 28 dage', () => {
    const s = YMD(2021, 1, 31);
    const e = addDuration(s, { mo: 1 });
    expect(e).toMatchObject({ y: 2021, mo: 2, d: 28 });
    expect(toJD(addDuration(s, diffDuration(s, e)))).toBe(toJD(e));
  });
});

describe('Usikre datoer (bibel-kronologi er omstridt)', () => {
  it('"ca."-præfiks + række-tekst', () => {
    const span: Span = {
      start: Y(-6), // 7 f.Kr.
      end: addDuration(Y(-6), { y: 37 }),
      uncertain: { latestStart: Y(-4), earliestEnd: Y(29) },
    };
    expect(formatSpan(span)).toMatch(/^ca\. 7 f\.Kr\./);
    expect(formatSpan({ ...span, uncertain: undefined })).not.toMatch(/^ca\./);
  });
});

describe('Relative dato-stilarter (zero-date)', () => {
  const zero = YMD(2020, 1, 1); // onsdag
  it('Dag-stil: 5. jan 12:00 → "Dag 4 kl. 12:00"', () => {
    const style = { kind: 'relative' as const, unit: 'day' as const, zero };
    expect(formatDate(T(2020, 1, 5, 12), style)).toBe('Dag 4 kl. 12:00');
  });
  it('Uge-stil: 15. jan → "Uge 2, onsdag"', () => {
    const style = { kind: 'relative' as const, unit: 'week' as const, zero };
    expect(formatDate(YMD(2020, 1, 15), style)).toBe('Uge 2, onsdag');
  });
  it('Tid-stil: +2t32m før zero → "-02:32"', () => {
    const style = { kind: 'relative' as const, unit: 'time' as const, zero };
    expect(formatDate(T(2019, 12, 31, 21, 28), style)).toBe('-02:32');
  });
});

describe('Parent-range-advarsler (blokerer ikke, advarer som Aeon)', () => {
  it('barn uden for forældrers tidsramme → advarselstekst', () => {
    const parent: Span = { start: Y(2020), end: YMD(2021, 1, 1) };
    expect(rangeWarning({ start: Y(2022) }, parent)).toMatch(/tillader ikke/);
    expect(rangeWarning({ start: Y(2020) }, parent)).toBeUndefined();
    expect(rangeWarning({ start: Y(2022) }, undefined)).toBeUndefined();
  });
});

// **** Regression: issue #6 — skudår-clamp, midnat-carry, BC-år i narrativ ****
describe('issue #6 dato-motor fixes', () => {
  it('29. feb + 1 år → 28. feb (ikke 1. mar)', () => {
    const r = addDuration(YMD(2024, 2, 29), { y: 1 });
    expect({ y: r.y, mo: r.mo, d: r.d }).toEqual({ y: 2025, mo: 2, d: 28 });
  });
  it('31. jan + 1 md → 29. feb (skudår) / 28. feb (almint)', () => {
    const a = addDuration(YMD(2024, 1, 31), { mo: 1 });
    expect({ y: a.y, mo: a.mo, d: a.d }).toEqual({ y: 2024, mo: 2, d: 29 });
    const b = addDuration(YMD(2025, 1, 31), { mo: 1 });
    expect({ y: b.y, mo: b.mo, d: b.d }).toEqual({ y: 2025, mo: 2, d: 28 });
  });
  it('29. feb + 4 år → 29. feb (gyldigt skudår forbliver)', () => {
    const r = addDuration(YMD(2024, 2, 29), { y: 4 });
    expect({ y: r.y, mo: r.mo, d: r.d }).toEqual({ y: 2028, mo: 2, d: 29 });
  });
  it('midnat-carry: 23:59:59.x runder til næste dag 00:00, ikke samme dag', () => {
    const jd = gregorianToJDN(2024, 1, 1) - 0.5 + (86399.6 / 86400);
    const r = fromJD(jd, 'time');
    expect({ y: r.y, mo: r.mo, d: r.d, h: r.h, mi: r.mi, s: r.s })
      .toEqual({ y: 2024, mo: 1, d: 2, h: 0, mi: 0, s: 0 });
  });
  it('BC-år: astronomisk 0 = 1 f.Kr., −1 = 2 f.Kr.', () => {
    expect(displayYear(0)).toBe('1 f.Kr.');
    expect(displayYear(-1)).toBe('2 f.Kr.');
  });
});
