// **** Billeder: IndexedDB blob-lagring (M11) ****
// Gemmer billeder separat fra doc-JSON for at holde dokumentet let.
// imageId → { blob, mimeType, filename }
import { openDB } from './persist';

export interface ImageEntry {
  blob: ArrayBuffer;
  mimeType: string; // 'image/png', 'image/jpeg'
  filename?: string;
}

const IMG_STORE = 'images';

/** Gem en billede-blob under given id. */
export async function putImage(id: string, entry: ImageEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).put(entry, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Hent billede som data-URI (til <img src=...>). */
export async function getImageUrl(id: string): Promise<string | null> {
  const entry = await getImage(id);
  if (!entry) return null;
  const base64 = arrayBufferToBase64(entry.blob);
  return `data:${entry.mimeType};base64,${base64}`;
}

/** Hent rå ImageEntry. */
export async function getImage(id: string): Promise<ImageEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readonly');
    const req = tx.objectStore(IMG_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ImageEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Slet billede. */
export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Gem mange billeder på én gang (bulk, hurtigere transaktion). */
export async function putImages(entries: Array<{ id: string; entry: ImageEntry }>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    const store = tx.objectStore(IMG_STORE);
    for (const { id, entry } of entries) store.put(entry, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Hent mange billed-entryer ad gangen (kun de der findes). */
export async function getImageEntries(ids: string[]): Promise<Array<{ id: string; entry: ImageEntry }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readonly');
    const store = tx.objectStore(IMG_STORE);
    const out: Array<{ id: string; entry: ImageEntry }> = [];
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => { if (req.result) out.push({ id, entry: req.result as ImageEntry }); };
      req.onerror = () => reject(req.error);
    }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

/** Alle billed-id'er i butikken. */
export async function listImageIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readonly');
    const req = tx.objectStore(IMG_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function abToB64(buf: ArrayBuffer): string {
  return arrayBufferToBase64(buf);
}

export function b64ToAb(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
