// **** IndexedDB persistence: asynk lagring af TimelineDoc (M5) ****
const DB_NAME = 'timeline-app';
const STORE_NAME = 'docs';
const DOC_KEY = 'current';

let dbReady: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbReady) return dbReady;
  dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
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
