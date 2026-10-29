// **** Review 04: ærlig gemme-status + synlige lagerfejl + genprøvning ****
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Styreflag: får persist-laget til at kaste (simuleret kvote-fejl).
let saveShouldFail = false;
const quota = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError' });

vi.mock('./core/persist', () => ({
  openDB: async () => ({}),
  saveDoc: async () => { if (saveShouldFail) throw quota(); },
  saveDocById: async () => { if (saveShouldFail) throw quota(); },
  loadDoc: async () => null,
  loadDocById: async () => null,
  listDocs: async () => [],
  deleteDocById: async () => {},
}));

function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const flush = () => new Promise<void>((r) => setTimeout(r, 10));

async function freshStore() {
  vi.resetModules();
  Object.defineProperty(globalThis, 'indexedDB', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  const mod = await import('./store');
  return mod.useApp;
}

describe('gemme-status (review 04)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    saveShouldFail = false;
    useApp = await freshStore();
  });

  it('markerer "saving" under gemning og "saved" bagefter', async () => {
    const st = () => useApp.getState();
    st().addItem({ label: 'X' }); // commit -> persist (synk 'saving' for det første await)
    expect(st().saveStatus).toBe('saving');
    await flush();
    expect(st().saveStatus).toBe('saved');
    expect(st().saveError).toBeNull();
  });

  it('lagerfejl: status = error, beskeden vises, men data BLIVER i hukommelsen', async () => {
    saveShouldFail = true;
    const st = () => useApp.getState();
    const id = st().addItem({ label: 'Tabt?husk mig' });
    await flush();
    expect(st().saveStatus).toBe('error');
    expect(st().saveError).toMatch(/Lagringspladsen er opbrugt/i);
    // Data er IKKE smidt ud — brugeren kan rette op / genprøve.
    expect(st().doc.items.some((i) => i.id === id)).toBe(true);
  });

  it('retrySave gemmer igen naar lagerfejlen er gaet over', async () => {
    saveShouldFail = true;
    const st = () => useApp.getState();
    const id = st().addItem({ label: 'Kritisk' });
    await flush();
    expect(st().saveStatus).toBe('error');
    saveShouldFail = false; // "plads frigjort"
    st().retrySave();
    expect(st().saveStatus).toBe('saving');
    await flush();
    expect(st().saveStatus).toBe('saved');
    expect(st().doc.items.some((i) => i.id === id)).toBe(true);
  });
});
