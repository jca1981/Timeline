import { describe, it, expect } from 'vitest';
import { contrastRatio, textColorFor, readableOn, isColor, parseHex, PANEL_BG } from './color';
import { TEMPLATES } from '../model/templates';
import { DEFAULT_TYPES } from '../model/doc';

describe('contrastRatio (WCAG)', () => {
  it('svarer til kendte vaerdier', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
  });

  it('haandler kort hex og slar fejlaktige vaerdier', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1);
    expect(() => contrastRatio('ikke-en-farve', '#000')).toThrow();
  });
});

describe('textColorFor (laeselig tekst pa en baggrund)', () => {
  it('valger moerk tekst pa gylden/gul (den ulaeselige kombination vi så i tidslinjen)', () => {
    const r = textColorFor('#d9a441');
    expect(r.color).toBe('#11141a');
    expect(contrastRatio(r.color, '#d9a441')).toBeGreaterThanOrEqual(4.5);
  });

  it('valger lys tekst pa moerk baggrund', () => {
    const r = textColorFor('#1e3a8a');
    expect(r.color).toBe('#ffffff');
    expect(contrastRatio(r.color, '#1e3a8a')).toBeGreaterThanOrEqual(4.5);
  });

  it('giver skygge der virker mod baggrunden (lys tekst -> moerk skygge)', () => {
    expect(textColorFor('#1e3a8a').shadow).toContain('0,0,0');
    expect(textColorFor('#d9a441').shadow).toContain('255,255,255');
  });

  it('falder tilbage pa hvid for ubekendte/ugyldige farver', () => {
    expect(textColorFor(undefined).color).toBe('#ffffff');
    expect(textColorFor('auto').color).toBe('#ffffff');
  });

  it('alle paletfarver (standard + skabeloner) får mindst 4.5:1 tekstkontrast', () => {
    const colors = [...DEFAULT_TYPES, ...TEMPLATES.flatMap((t) => t.build().itemTypes)].map((t) => t.color);
    expect(colors.length).toBeGreaterThan(5);
    for (const c of colors) {
      const r = textColorFor(c);
      expect(contrastRatio(r.color, c), `kontrast for ${c}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('readableOn (farve pa baggrund, fx etiket uden for bjelken)', () => {
  it('justerer en for moerk farve sa den lyser mod maerk baggrund', () => {
    const out = readableOn('#c0392b', '#232830');
    expect(out).not.toBe('#c0392b');
    expect(contrastRatio(out, '#232830')).toBeGreaterThanOrEqual(4.5);
  });

  it('lader en allerede laeselig farve vaere uraert', () => {
    expect(readableOn('#e8ecf4', '#232830')).toBe('#e8ecf4');
  });

  it('bevarer ham-familien (kun lysreguleres)', () => {
    const out = readableOn('#c0392b', '#232830');
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out.slice(1, 3)).not.toBe('00'); // ikke naesten sort
  });

  it('tolerer ugyldige vaerdier uden at kaeste', () => {
    expect(readableOn('auto', '#232830')).toBe('auto');
  });

  // Importerede .aeon-filer bruger CSS-navne (brugerdokument: gule bjælker med hvid tekst)
  it('forstaar CSS-farvenavne som hex', () => {
    expect(isColor('yellow')).toBe(true);
    expect(parseHex('yellow')).toEqual([255, 255, 0]);
    expect(parseHex('Orange')).toEqual([255, 165, 0]);
  });

  it('giver mørk tekst paa gule/orange/gyldne bjælker (navngivne farver)', () => {
    for (const bg of ['yellow', 'orange', 'gold', 'lime']) {
      const r = textColorFor(bg);
      expect(contrastRatio(r.color, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lyser en navngivnet mættet farve op mod maerket panel', () => {
    const out = readableOn('red', PANEL_BG);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrastRatio(out, PANEL_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

export {};
