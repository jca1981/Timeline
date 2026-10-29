// task 05: sikker kopi maa inkludere billederne, og gendannelse skal verifikationstaelle.
// Korer mod fake-indexeddb sä biller-lagret er et rigtigt IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, restoreImages } from './backup';
import { putImage, getImage, deleteImage } from './images';
import type { TimelineDoc } from '../model/doc';

const doc = (items: unknown[]): TimelineDoc =>
  ({ name: 'D', version: 1, items }) as unknown as TimelineDoc;

describe('sikker kopi (task 05)', () => {
  it('buildBackup tar kun de billeder der er refereret; restoreImages gendanner og taeller', async () => {
    const bytes = new TextEncoder().encode('BILLEDDATA').buffer;
    await putImage('img1', { blob: bytes, mimeType: 'image/png', filename: 'a.png' });
    await putImage('imgUbruagt', { blob: bytes, mimeType: 'image/jpeg' }); // ikke refereret -> skal IKKE med

    const d = doc([{ id: 'a', label: 'A', span: { start: { y: 1 }, end: { y: 2 } }, imageId: 'img1' }]);
    const bf = await buildBackup(d);
    expect(bf.kind).toBe('timeline-backup');
    expect(bf.images.map((i) => i.id)).toEqual(['img1']); // kun den refererede

    // "slet" billedet sä vi gendanner fra backuppen
    await deleteImage('img1');
    expect(await getImage('img1')).toBeNull();

    const r = await restoreImages(bf);
    expect(r).toEqual({ expected: 1, restored: 1, missing: [] });
    const back = await getImage('img1');
    expect(back).not.toBeNull();
    expect(back!.mimeType).toBe('image/png');
    expect(back!.filename).toBe('a.png');
    expect(new TextDecoder().decode(back!.blob)).toBe('BILLEDDATA');
  });

  it('restoreImages melder manglende billed (verifikation, ikke blind paastand)', async () => {
    const bf = {
      kind: 'timeline-backup' as const, version: 1 as const, savedAt: '',
      doc: doc([]),
      images: [{ id: 'ok', mimeType: 'image/png', base64: 'aGk=' }],
    };
    await putImage('ok', { blob: new TextEncoder().encode('hi').buffer, mimeType: 'image/png' });
    const r = await restoreImages(bf);
    expect(r.restored).toBe(1);
    expect(r.missing).toEqual([]);
  });

  it('parseBackup afviser ikke-backup og udulentige billed-indgange', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow();
    expect(() => parseBackup({ kind: 'timeline-backup', doc: { items: [] } })).toThrow(); // mangler images-array
    expect(() =>
      parseBackup({ kind: 'timeline-backup', doc: { items: [] }, images: [{ id: 'x' }] }), // billed uden base64/mime
    ).toThrow();
  });
});
