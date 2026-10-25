import { describe, expect, it } from 'vitest';
import { panCenter, panPoint } from './pan';

// Regression: "Cannot read properties of null (reading 'center')" crashede hele appen
// (rodtræet blev afmonteret → hvid side) fordi en state-opdatering læste i en pointer-ref.

describe('panCenter (tidslinje/compare pan)', () => {
  it('flytter center modsat drag-retningen, skaleret med px', () => {
    const v = { center: 1000, px: 2 };
    expect(panCenter(v, { x: 100, center: 1000 }, 140).center).toBe(980); // træk 40px til h jre
    expect(panCenter(v, { x: 100, center: 1000 }, 60).center).toBe(1020);
  });

  it('returnerer uændret viewport når drag er null (pointerup k rer forst)', () => {
    const v = { center: 1000, px: 2 };
    expect(panCenter(v, null, 140)).toEqual(v);
    expect(() => panCenter(v, null, 140)).not.toThrow();
  });

  it('bruger v rdi-kopi, ikke den oprindelige ref (ref kan blive nulleret)', () => {
    const drag = { x: 100, center: 1000 };
    const snapshot = { ...drag };
    drag.center = NaN; // simuler at kilden er tyndet/ ndret
    const out = panCenter({ center: 0, px: 1 }, snapshot, 150);
    expect(out.center).toBe(950);
  });

  it('nægter uggyldig px / NaN clientX (ingen NaN i viewport)', () => {
    const v = { center: 1000, px: 0 };
    expect(panCenter(v, { x: 0, center: 1000 }, 50)).toEqual(v);
    const v2 = { center: 1000, px: Number.NaN };
    expect(panCenter(v2, { x: 0, center: 1000 }, 50)).toEqual(v2);
    expect(panCenter({ center: 5, px: 1 }, { x: 0, center: 5 }, Number.NaN)).toEqual({ center: 5, px: 1 });
  });

  it('bevarer px uændret', () => {
    expect(panCenter({ center: 10, px: 0.25 }, { x: 0, center: 10 }, 4).px).toBe(0.25);
  });
});

describe('panPoint (slægtstræ-pan)', () => {
  it('adderer drag-delta til origo', () => {
    const out = panPoint({ x: 0, y: 0 }, { startX: 50, startY: 60, origX: 20, origY: 30 }, 70, 40);
    expect(out).toEqual({ x: 40, y: 10 });
  });

  it('returnerer uændret når drag er null', () => {
    const v = { x: 3, y: 4 };
    expect(panPoint(v, null, 99, 99)).toEqual(v);
    expect(() => panPoint(v, null, 99, 99)).not.toThrow();
  });

  it('bevarer ekstra felter som scale (sl ggtstr-vesets viewport-type)', () => {
    const v = { x: 0, y: 0, scale: 2 };
    expect(panPoint(v, { startX: 0, startY: 0, origX: 10, origY: 10 }, 15, 12)).toEqual({ x: 25, y: 22, scale: 2 });
  });

  it('nægter NaN-klientkoordinater', () => {
    const v = { x: 3, y: 4 };
    expect(panPoint(v, { startX: 0, startY: 0, origX: 1, origY: 1 }, Number.NaN, 5)).toEqual(v);
  });
});
