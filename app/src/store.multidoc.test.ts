// **** Multi-doc integration (issue #5): switch/new/delete hydrate-race ****
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

// fake-indexeddb's callbacks kvaerer via macrotasks — tøm køen pænt.
const flush = () => new Promise<void>((r) => setTimeout(r, 30));

async function freshStore() {
  vi.resetModules();
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  const mod = await import('./store');
  return mod.useApp;
}

const LS_KEY = 'aeon-clone:doc:v1';
const LS_DOCID = 'aeon-clone:docId:v1';

describe('multi-doc (issue #5)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('nyt dokument overskriver IKKE det aktive, og skifter til sig selv', async () => {
    const st = () => useApp.getState();
    st().importDoc({ ...st().doc, name: 'Værk', items: [{ ...st().doc.items[0]!, id: 'a1', label: 'Skabt' }] });
    await flush();
    const activeId = localStorage.getItem(LS_DOCID) ?? 'current'; // det dok newDoc ikke må ramme
    st().newDoc('Ny sag');
    await flush();

    // aktiv = det nye, og dets indhold er tomt (ikke 'Skabt')
    expect(st().doc.name).toBe('Ny sag');
    expect(st().doc.items.length).toBe(0);
    // det gamle værk er materialiseret under sin egen profil-id og findes stadig
    const persist = await import('./core/persist');
    const vaerk = (await persist.listDocs()).find((d) => d.name === 'Værk');
    expect(vaerk).toBeTruthy();
    const old = await persist.loadDocById<{ items: { label: string }[] }>(vaerk!.id);
    expect(old!.items.map((i: any) => i.label)).toContain('Skabt');
    // og det nye har sit EGET id (ikke 'current')
    expect(localStorage.getItem(LS_DOCID)).not.toBe('current');
    expect(localStorage.getItem(LS_DOCID)).not.toBe(activeId);
  });

  it('nyt dokument er synligt i listen og aktivt efter reload', async () => {
    useApp.getState().newDoc('Sag A');
    await flush();
    expect(localStorage.getItem(LS_DOCID)).not.toBe('current'); // eget id, ikke 'current'-sløret
    const list = await (await import('./core/persist')).listDocs();
    expect(list.map((d) => d.name)).toContain('Sag A');
    // "reload": ny sync-cache-læsning fra samme localStorage
    const cached = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(cached.name).toBe('Sag A');
  });

  it('switchDoc gemmer redigeringer i gamle dokument (tab-fiksen)', async () => {
    const st = () => useApp.getState();
    st().newDoc('A');
    await flush();
    const aId = JSON.parse(localStorage.getItem(LS_KEY)!).name === 'A';
    expect(aId).toBe(true);
    st().addItem({ label: 'I A' });
    st().newDoc('B');
    await flush();
    st().addItem({ label: 'I B' });
    await flush();
    const list = await (await import('./core/persist')).listDocs();
    const a = list.find((d) => d.name === 'A')!;
    const aDoc = await (await import('./core/persist')).loadDocById<{ items: { label: string }[] }>(a.id);
    expect(aDoc!.items.map((i) => i.label)).toContain('I A');
  });

  it('slettet dokument sletter OGSÅ current-cache og genopstår ikke efter reload', async () => {
    const st = () => useApp.getState();
    st().newDoc('Slet mig');
    await flush();
    const list1 = await (await import('./core/persist')).listDocs();
    const doomed = list1.find((d) => d.name === 'Slet mig')!;
    const otherId = localStorage.getItem(LS_DOCID); // aktiv = doomed
    expect(otherId).toBe(doomed.id);

    await st().deleteDoc(doomed.id);
    await flush();

    // ikke længere i liste eller lager
    const list2 = await (await import('./core/persist')).listDocs();
    expect(list2.find((d) => d.id === doomed.id)).toBeFalsy();
    expect(await (await import('./core/persist')).loadDocById(doomed.id)).toBeNull();
    // current-cache er overskrevet → ingen genopstandelse ved "reload"
    const cached = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(cached.items.find((i: any) => i.name === 'Slet mig')).toBeFalsy();
    expect(localStorage.getItem(LS_DOCID)).not.toBe(doomed.id);
  });

  it('hydrate-race: import midt i hydrate vinder (bliver ikke overskrevet)', async () => {
    const persistMod = await import('./core/persist');
    // gem et gammelt docs-dokument i IndexedDB under 'current'
    await persistMod.saveDoc({ ...emptyish(), name: 'Gammelt IDB-doc', items: [{ id: 'z', typeId: 'event', label: 'Gammel', span: { start: { y: 1, precision: 'year' } } }] });
    await flush();

    const mod = await import('./store'); // frisk husk (localStorage tom → start tomt)
    const hydrating = mod.hydrateStore(); // async læsning i gang
    mod.useApp.getState().importDoc({ ...emptyish(), name: 'Demo', items: [{ id: 'd', typeId: 'event', label: 'Demo-post', span: { start: { y: 2, precision: 'year' } } }] });
    await hydrating;
    await flush();

    expect(mod.useApp.getState().doc.name).toBe('Demo');
    expect(mod.useApp.getState().doc.items.map((i) => i.label)).toContain('Demo-post');
  });

  it('commit() skriver til IndexedDB (ikke kun localStorage)', async () => {
    const id = useApp.getState().addSource({ title: 'IDB-kilde' });
    expect(id).toBeTruthy();
    await flush();
    const saved = await (await import('./core/persist')).loadDoc<{ sources: { title: string }[] }>();
    expect(saved!.sources.map((s) => s.title)).toContain('IDB-kilde');
  });

  it('switchDoc tab-test: indhold bevaret ved frem/tilbage-tab', async () => {
    const st = () => useApp.getState();
    st().newDoc('A');
    await flush();
    st().addItem({ label: 'Kun i A' });
    await flush();
    const b = st().newDoc('B');
    void b;
    await flush();
    const list2 = await (await import('./core/persist')).listDocs();
    const a = list2.find((d) => d.name === 'A')!;
    await st().switchDoc(a.id);
    await flush();
    expect(st().doc.items.map((i) => i.label)).toContain('Kun i A');
    const bId = list2.find((d) => d.name === 'B')!;
    await st().switchDoc(bId.id);
    await flush();
    expect(st().doc.name).toBe('B');
    expect(st().doc.items.length).toBe(0);
  });
});

function emptyish() {
  return { name: '', itemTypes: [], relationTypes: [], items: [], relations: [], dependencies: [], savedFilters: {}, sources: [] } as any;
}
