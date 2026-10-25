import { describe, it, expect } from 'vitest';
import { exportAsHtml } from './exportHtml';
import { emptyDoc, type Item } from '../model/doc';

function mkItem(id: string, label: string, y1: number, y2: number): Item {
  return { id, typeId: 't-event', label, span: { start: { y: y1, precision: 'year' }, end: { y: y2, precision: 'year' } } };
}

describe('exportAsHtml', () => {
  it('returns valid HTML with title and SVG', () => {
    const doc = emptyDoc('Test');
    doc.items = [mkItem('a', 'Fødsel', -5, 30), mkItem('b', 'Død', 20, 60)];
    const html = exportAsHtml(doc);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test</title>');
    expect(html).toContain('<svg');
    expect(html).toContain('Fødsel');
    expect(html).toContain('Død');
  });

  it('includes era bands for parent items with many children', () => {
    const doc = emptyDoc('Era');
    doc.items = [
      mkItem('era1', 'Æra', -100, 100),
      mkItem('a', 'A', -90, -80),
      mkItem('b', 'B', -70, -60),
      mkItem('c', 'C', -50, -40),
    ];
    for (const id of ['a', 'b', 'c']) {
      doc.items.find((x) => x.id === id)!.parentId = 'era1';
    }
    const html = exportAsHtml(doc);
    expect(html).toContain('Æra');
    expect(html).toContain('opacity="0.05"');
  });

  it('reports dateless count', () => {
    const doc = emptyDoc('Dato-løs');
    doc.items = [mkItem('a', 'Dateret', 2020, 2025)];
    doc.items.push({ id: 'x', typeId: 't-event', label: 'Uden dato', span: {} });
    const html = exportAsHtml(doc);
    expect(html).toContain('(1 uden dato)');
  });

  it('filter parameter limits items', () => {
    const doc = emptyDoc('Filter');
    doc.items = [mkItem('a', 'Kun denne', 2000, 2010), mkItem('b', 'Ikke denne', 2020, 2030)];
    const html = exportAsHtml(doc, (it) => it.label === 'Kun denne');
    expect(html).toContain('Kun denne');
    expect(html).not.toContain('Ikke denne');
  });

  it('empty doc returns message', () => {
    const doc = emptyDoc('Tom');
    const html = exportAsHtml(doc);
    expect(html).toContain('Tomt dokument');
  });

  // Regression: ondartet import (labels/navne/farver fra en .aeon) må ikke kunne injicere
  // script i den eksporterede, selvstaendige HTML-fil.
  it('escapes ondartet indhold sä eksporten ikke kan indeholde script', () => {
    const doc = emptyDoc('On<scr' + 'ipt>alert(1)</scr' + 'ipt>dt');
    const evil = mkItem('e', '<scr' + 'ipt>alert(1)</scr' + 'ipt>', 2000, 2010);
    evil.color = '#fff" onload="alert(1)';
    doc.items = [evil];
    const html = exportAsHtml(doc);
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('onload=');
    expect(html).toContain('fill="#888"'); // ugyldig farve → sicher fallback
  });

  // Regression: gylden bjaelke + hvid tekst var ulaeselig (1.9:1) - eksporten skal ogsa vaere laeselig.
  it('bruger kontrastfarve pa laeselig vis i SVG-eksporten', () => {
    const doc = emptyDoc('Gylden');
    const it = mkItem('n', 'Rige', -500, 100);
    it.color = '#d9a441';
    doc.items = [it];
    const html = exportAsHtml(doc);
    expect(html).not.toContain('fill="#fff"');
    expect(html).toMatch(/fill="#11141a"/); // moerk tekst pa den gyldne bjaelke
  });

  // M28: kilder skal følge med ud i eksporten — ellers er den delte fil bare
  // pástande uden belæg.
  it('udskriver kildemarkører og kildeliste', () => {
    const doc = emptyDoc('Med kilder');
    doc.sources = [
      { id: 's1', title: 'Studiebibelen', locator: 's. 214', url: 'https://example.org/studie' },
      { id: 's2', title: 'Urtekilde', notes: 'tjek mod denne' },
    ];
    const a = mkItem('a', 'Fødsel', -5, 30);
    a.sourceIds = ['s1', 's2'];
    const b = mkItem('b', 'Død', 20, 60);
    b.sourceIds = ['s1'];
    doc.items = [a, b];
    const html = exportAsHtml(doc);
    expect(html).toContain('<ol class="srcs">');
    expect(html).toContain('Studiebibelen — s. 214');
    expect(html).toContain('href="https://example.org/studie"');
    expect(html).toContain('<li id="k1">');
    expect(html).toContain('[1,2]'); // markør for a
    expect(html).toContain('[1]'); // markør for b
    expect(html).toContain('2 kilder');
  });

  // Kildetekster og -URL'er kommer fra import og er lige så utroværdige som labels.
  it('escapes kildetekster og afviser javascript:-URL', () => {
    const doc = emptyDoc('Usikker kilde');
    doc.sources = [
      { id: 's1', title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' },
    ];
    const a = mkItem('a', 'Post', 2000, 2010);
    a.sourceIds = ['s1'];
    doc.items = [a];
    const html = exportAsHtml(doc);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('href="javascript:');
  });
});
