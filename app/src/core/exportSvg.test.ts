// **** Issue #8: SVG-eksport må ikke kunne injicere markup via importerede felter ****
import { describe, it, expect } from 'vitest';
import { exportAsSvg } from './exportSvg';
import { emptyDoc, type Item } from '../model/doc';

describe('issue #8 SVG-eksport escaping', () => {
  it('ondsindest label og color injicerer ikke markup i SVG', () => {
    const doc = emptyDoc('X');
    doc.itemTypes = [{ id: 't-event', name: 'E', color: '#888' }];
    doc.items = [{
      id: 'a', typeId: 't-event', label: '<script>bad()</script>',
      span: { start: { y: 2000, precision: 'year' }, end: { y: 2100, precision: 'year' } },
      color: '#000" onload="alert(1)',
    } as Item];
    const svg = exportAsSvg(doc);
    expect(svg).not.toContain('<script>'); // label tekst-escapet, kan ikke lukke et tag op
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('onload='); // color kan ikke bryde ud af fill-attributten
    expect(svg).toContain('#888'); // safeColor fallback for ulovlig color
  });
});
