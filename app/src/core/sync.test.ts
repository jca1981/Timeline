// **** Issue #7: syncSpan skal afvise kalender-ugyldige datoer med dansk besked ****
import { describe, it, expect } from 'vitest';
import { syncSpan } from './sync';

describe('syncSpan kalendervalidering (#7)', () => {
  it('31. februar → fejl, raawærdi returneret (ingen korruption)', () => {
    const r = syncSpan({ start: { y: 2024, mo: 2, d: 31, precision: 'day' } });
    expect(r.error).toBeTruthy();
    expect(r.span!.start).toEqual({ y: 2024, mo: 2, d: 31, precision: 'day' });
  });

  it('måned 13 → fejl', () => {
    const r = syncSpan({ start: { y: 2024, mo: 13, precision: 'month' } });
    expect(r.error).toBeTruthy();
  });

  it('ugyldig slutdato → fejl', () => {
    const r = syncSpan({ start: { y: 2024, mo: 1, d: 1, precision: 'day' }, end: { y: 2024, mo: 9, d: 31, precision: 'day' } });
    expect(r.error).toBeTruthy();
  });

  it('gyldig dato (skudår 29. feb) → ingen fejl', () => {
    const r = syncSpan({ start: { y: 2024, mo: 2, d: 29, precision: 'day' } });
    expect(r.error).toBeUndefined();
  });
});
