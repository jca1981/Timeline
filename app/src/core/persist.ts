// **** IndexedDB persistence: asynk lagring af TimelineDoc (M5) ****
const DB_NAME = 'timeline-app';
const STORE_NAME = 'docs';
const DOC_KEY = 'current';
const LIST_KEY = '_doclist';

let dbReady: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbReady) return dbReady;
  dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3); // v3: images store
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbReady;
}

/** Gem dokument (overskriver eksisterende). */
export async function saveDoc(data: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, DOC_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback til localStorage hvis IndexedDB fejler (fx private browsing)
    try { localStorage.setItem('aeon-clone:doc:v1', JSON.stringify(data)); } catch { /* give up */ }
  }
}

/** Hent dokument (null hvis intet gemt). */
export async function loadDoc<T>(): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(DOC_KEY);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // fallback: prøv localStorage
    try {
      const raw = localStorage.getItem('aeon-clone:doc:v1');
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }
}

/** Slet gemt dokument. */
export async function clearDoc(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(DOC_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem('aeon-clone:doc:v1');
  }
}

// **** Multi-document profiles (M9) ****

export interface DocMeta { id: string; name: string; updatedAt: number; }

/** List all saved doc profiles. */
export async function listDocs(): Promise<DocMeta[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(LIST_KEY);
      req.onsuccess = () => resolve((req.result as DocMeta[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

/** Save a doc under a specific profile id. */
export async function saveDocById(id: string, data: unknown, name: string): Promise<void> {
  try {
    const db = await openDB();
    // EEN readwrite-transaktion: undgå race hvor to samtidige saves læser samme
    // gamle liste og overskriver hinanden (mistede dokumenter i listen).
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, id);
      const req = store.get(LIST_KEY);
      req.onsuccess = () => {
        const list: DocMeta[] = (req.result as DocMeta[]) ?? [];
        const meta: DocMeta = { id, name, updatedAt: Date.now() };
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) list[idx] = meta; else list.push(meta);
        store.put(list, LIST_KEY);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silent */ }
}

/** Load a doc by profile id. */
export async function loadDocById<T>(id: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

/** Delete a doc profile. */
export async function deleteDocById(id: string): Promise<void> {
  try {
    const db = await openDB();
    const list = await listDocs();
    const newList = list.filter((d) => d.id !== id);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      store.put(newList, LIST_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silent */ }
}
