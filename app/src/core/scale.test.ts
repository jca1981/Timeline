// **** Tests af timeline-scale: zoom-trin, ticks over BC/AD, spænd→JD-bounds ****
import { describe, expect, it } from 'vitest';
import { contentBounds, pickStep, spanBounds, ticksFor } from './scale';
import { addDuration, toJD } from './jdn';
import type { Span } from './types';

const YMD = (y: number, mo: number, d = 1) => ({ y, mo, d, precision: 'day' as const });

describe('zoom-trin', () => {
  it('yderlig zoom ud → 5000-årstrin; ekstremt ind → 10 sek', () => {
    expect(pickStep(1 / 500_000)).toEqual({ kind: 'year', n: 5000 });
    expect(pickStep(172_800)).toEqual({ kind: 'time', sec: 30 });
  });
  it('år-skala (~1 px/dag) → måneds- eller årstrin', () => {
    const s = pickStep(1);
    expect(['month', 'year']).toContain(s.kind);
  });
});

describe('ticks', () => {
  it('årsticks over 1 f.Kr. ↔ 1 e.Kr. uden at gå i loop', () => {
    const left = toJD(YMD(-10, 1));
    const right = toJD(YMD(10, 1));
    const t = ticksFor(left, right, 0.2); // ~0.2 px/dag → 1-årstrin
    const labels = t.map((x) => x.label);
    expect(labels).toContain('1 f.Kr.');
    expect(labels).toContain('1');
    expect(t.length).toBeLessThan(200);
    // stigende JD
    for (let i = 1; i < t.length; i++) expect(t[i].jd).toBeGreaterThan(t[i - 1].jd);
  });
  it('kvartals-ticks følger kalenderen over årskiftet (dec → jan)', () => {
    const left = toJD(YMD(-6, 11));
    const right = toJD(YMD(-3, 3)); // marts 4 f.Kr.
    const t = ticksFor(left, right, 0.7); // ~0.7 px/dag → kvartals-trin
    const labels = t.map((x) => x.label);
    expect(labels).toContain('oktober 6 f.Kr.');
    expect(labels).toContain('januar 5 f.Kr.');
    expect(labels).toContain('januar 4 f.Kr.');
  });
  it('uge-ticks lander på mandage', () => {
    const left = toJD(YMD(2026, 10, 1));
    const right = toJD(YMD(2026, 11, 1));
    const t = ticksFor(left, right, 8); // uger
    for (const tick of t) {
      const jdInt = Math.floor(tick.jd + 0.5);
      expect(((jdInt % 7) + 7) % 7).toBe(0); // JDN % 7: 0 = mandag
    }
  });
  it('tid-ticks under døgn-skala viser kl.', () => {
    const left = toJD(YMD(2026, 10, 23)) + 8 / 24;
    const right = left + 12 / 24;
    const t = ticksFor(left, right, 20_000); // time-trin
    expect(t.some((x) => x.label.startsWith('kl.'))).toBe(true);
  });
});

describe('spænd→JD-bounds', () => {
  it('start + varighed giver rigtig bredde (2 år ≈ 730 dage)', () => {
    const bd = spanBounds({ start: { y: 2021, precision: 'year' }, duration: { y: 2 } })!;
    expect(bd.b - bd.a).toBeCloseTo(730, 0); // 2021-01-01 → 2023-01-01 = 730 dage
  });
  it('kun start = punkt', () => {
    const bd = spanBounds({ start: { y: -4, precision: 'year' } })!;
    expect(bd.b).toBe(bd.a);
    expect(bd.ua).toBeUndefined();
  });
  it('ongoing slutter "nu"', () => {
    const bd = spanBounds({ start: { y: 2026, mo: 10, precision: 'month' }, ongoing: true })!;
    expect(bd.b).toBeGreaterThan(toJD(YMD(2026, 10, 1)) - 1);
  });
  it('usikker: latestStart udvider halo til højre for start', () => {
    const span: Span = {
      start: { y: -3, precision: 'year' },
      uncertain: { latestStart: { y: -2, precision: 'year' } },
    };
    const bd = spanBounds(span)!;
    expect(bd.ua).toBeGreaterThan(bd.a);
    expect(bd.ua! - bd.a).toBeCloseTo(365.25, -1);
  });
  it('kun slut + varighed: start beregnes baglæns', () => {
    const span: Span = { end: YMD(2021, 3, 31), duration: { mo: 2 } };
    const bd = spanBounds(span)!;
    const expected = toJD(addDuration(YMD(2021, 3, 31), { mo: -2 }));
    expect(bd.a).toBeCloseTo(expected, 5);
  });
  it('helt uden dato → ingen bounds', () => {
    expect(spanBounds({ duration: { y: 3 } })).toBeUndefined();
  });
  it('contentBounds samler ydergrænser på tværs af poster', () => {
    const cb = contentBounds([
      { start: { y: -454, precision: 'year' }, duration: { y: 483 } },
      { start: YMD(2026, 10, 1), ongoing: true },
    ])!;
    expect(cb.left).toBe(toJD({ y: -454, precision: 'year' }));
    expect(cb.right).toBeGreaterThan(toJD(YMD(2026, 10, 1)));
  });
});
