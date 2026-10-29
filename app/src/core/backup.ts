// **** Sikker kopi (task 05): fuld eksport/inkl. billeder + verificeret gendannelse ****
// Den alm. JSON-eksport mister billederne (de ligger i en separat IndexedDB-store).
// En "sikker kopi" tar dokumentet OG alle billeder det refererer med, sa genetically kan ske.
import type { TimelineDoc } from '../model/doc';
import { getImageEntries, putImages, abToB64, b64ToAb } from './images';

export interface BackupImage {
  id: string;
  mimeType: string;
  filename?: string;
  base64: string; // blob som base64 (JSON-venlig)
}

export interface BackupFile {
  kind: 'timeline-backup';
  version: 1;
  savedAt: string;
  doc: TimelineDoc;
  images: BackupImage[];
}

/** Saml dokument + alle dets refererede billeder til én backup-fil. */
export async function buildBackup(doc: TimelineDoc): Promise<BackupFile> {
  const ids = [...new Set(doc.items.map((i) => i.imageId).filter((x): x is string => !!x))];
  const entries = await getImageEntries(ids);
  return {
    kind: 'timeline-backup',
    version: 1,
    savedAt: new Date().toISOString(),
    doc,
    images: entries.map((e) => ({
      id: e.id,
      mimeType: e.entry.mimeType,
      filename: e.entry.filename,
      base64: abToB64(e.entry.blob),
    })),
  };
}

/** Valider at en ruekt fil er en sikker kopi; ellers fejl (kaldsiden afviser). */
export function parseBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object' || (raw as BackupFile).kind !== 'timeline-backup') {
    throw new Error('ikke en sikker kopi (mangler kind=timeline-backup)');
  }
  const bf = raw as BackupFile;
  if (!bf.doc || !Array.isArray(bf.doc.items) || !Array.isArray(bf.images)) {
    throw new Error('udulentig sikker kopi: mangler doc.items eller images');
  }
  for (const im of bf.images) {
    if (typeof im?.id !== 'string' || typeof im?.base64 !== 'string' || typeof im?.mimeType !== 'string') {
      throw new Error('udulentig sikker kopi: fejlhaftig billed-indgang');
    }
  }
  return bf;
}

/**
 * Læg billederne fra backuppen tilbage i IndexedDB og VERIFICÉR antal.
 * returnerer { expected, restored, missing } sa UI kan paa et aendeligt tal.
 */
export async function restoreImages(bf: BackupFile): Promise<{ expected: number; restored: number; missing: string[] }> {
  const entries = bf.images.map((im) => ({
    id: im.id,
    entry: { blob: b64ToAb(im.base64), mimeType: im.mimeType, filename: im.filename },
  }));
  if (entries.length) await putImages(entries);
  const present = await getImageEntries(bf.images.map((im) => im.id));
  const have = new Set(present.map((p) => p.id));
  const missing = bf.images.map((im) => im.id).filter((id) => !have.has(id));
  return { expected: bf.images.length, restored: have.size, missing };
}
