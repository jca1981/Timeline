// **** Store-tests (issue #1 + #11): commit()-vejen — UI, persist og undo hænger sammen ****
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage-stub (Node-miljø); persist() falder tilbage hertil når IndexedDB mangler.
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

async function freshStore() {
  vi.resetModules();
  // Ryd DOM-globals mellem tests (modulet læser localStorage ved oprettelse).
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  const mod = await import('./store');
  return mod.useApp;
}

const LS_KEY = 'aeon-clone:doc:v1';

describe('source-crud (issue #1)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('addSource opdaterer UI-state OG persisterrer', () => {
    const id = useApp.getState().addSource({ title: 'Genesis', locator: '1 Mos' });
    expect(id).toBeTruthy();
    expect(useApp.getState().doc.sources?.map((s) => s.title)).toContain('Genesis');
    const persisted = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(persisted.sources?.map((s: { title: string }) => s.title)).toContain('Genesis');
  });

  it('addSource uden titel ignoreres; dublet genbruges', () => {
    useApp.getState().addSource({ title: '  ' });
    expect(useApp.getState().doc.sources?.length ?? 0).toBe(0);
    const a = useApp.getState().addSource({ title: 'A' });
    const b = useApp.getState().addSource({ title: 'a' });
    expect(b).toBe(a);
    expect(useApp.getState().doc.sources?.length).toBe(1);
  });

  it('updateSource opdaterer UI-state og kan fortrydes med undo', () => {
    const id = useApp.getState().addSource({ title: 'Genesis' });
    useApp.getState().updateSource(id, { title: 'Anden Mosebog' });
    expect(useApp.getState().doc.sources![0].title).toBe('Anden Mosebog');
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).sources[0].title).toBe('Anden Mosebog');

    useApp.getState().undoAction();
    expect(useApp.getState().doc.sources![0].title).toBe('Genesis');
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).sources[0].title).toBe('Genesis');

    useApp.getState().redoAction();
    expect(useApp.getState().doc.sources![0].title).toBe('Anden Mosebog');
  });

  it('removeSource fjerner kilde OG kilde-links på poster, kan fortrydes', () => {
    const srcId = useApp.getState().addSource({ title: 'Kildeskrift' });
    const itemId = useApp.getState().addItem({ label: 'Post', sourceIds: [srcId] });
    useApp.getState().removeSource(srcId);
    expect(useApp.getState().doc.sources?.length).toBe(0);
    expect(useApp.getState().doc.items.find((i) => i.id === itemId)!.sourceIds).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).sources.length).toBe(0);

    useApp.getState().undoAction();
    expect(useApp.getState().doc.sources?.length).toBe(1);
    expect(useApp.getState().doc.items.find((i) => i.id === itemId)!.sourceIds).toEqual([srcId]);
  });

  it('toggleSource kan fortrydes (ctrl+z-gen vejen gennem updateItem)', () => {
    const srcId = useApp.getState().addSource({ title: 'Bog' });
    const itemId = useApp.getState().addItem({ label: 'Post' });
    useApp.getState().toggleSource(itemId, srcId);
    expect(useApp.getState().doc.items.find((i) => i.id === itemId)!.sourceIds).toEqual([srcId]);
    useApp.getState().undoAction();
    expect(useApp.getState().doc.items.find((i) => i.id === itemId)!.sourceIds).toBeUndefined();
  });
});

describe('issue #4: reorder + dokumentnavn', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('reorderItems gemmer rækkefoelgen i state og lager, og kan fortrydes', () => {
    const st = () => useApp.getState();
    const a = st().addItem({ label: 'A' });
    const b = st().addItem({ label: 'B' });
    st().reorderItems(b, a);
    expect(st().doc.items.map((i) => i.label)).toEqual(['B', 'A']);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).items.map((i: { label: string }) => i.label)).toEqual(['B', 'A']);
    st().undoAction();
    expect(st().doc.items.map((i) => i.label)).toEqual(['A', 'B']);
  });

  it("reorderItems med ukendte id'er gor ingen ting", () => {
    const a = useApp.getState().addItem({ label: 'A' });
    useApp.getState().reorderItems(a, 'fx-eksisterer-ikke');
    expect(useApp.getState().doc.items.length).toBe(1);
  });

  it('renameDoc gemmer navn i state og lager (overlever reload)', () => {
    useApp.getState().renameDoc('Mit vaerk');
    expect(useApp.getState().doc.name).toBe('Mit vaerk');
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).name).toBe('Mit vaerk');
  });

  it('flere rename-klik kollapser til én undo', () => {
    useApp.getState().renameDoc('M');
    useApp.getState().renameDoc('Mi');
    useApp.getState().renameDoc('Min bog');
    useApp.getState().undoAction();
    expect(useApp.getState().doc.name).not.toBe('Min bog');
  });
});

describe('issue #3: destriuktive handlinger kan fortrydes', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('clearAll kan fortrydes og genopretter poster + lager', () => {
    const st = () => useApp.getState();
    st().addItem({ label: 'Fad1' });
    st().addItem({ label: 'Fad2' });
    st().clearAll();
    expect(st().doc.items.length).toBe(0);
    st().undoAction();
    expect(st().doc.items.map((i) => i.label)).toEqual(['Fad1', 'Fad2']);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).items.length).toBe(2);
  });

  it('importDoc (demo/skabelon) kan fortrydes', () => {
    const st = () => useApp.getState();
    st().addItem({ label: 'Min lokale' });
    const before = st().doc;
    st().importDoc({ ...before, name: 'Importeret', items: [...before.items, { ...before.items[0], id: 'ny-1', label: 'Importert' }] });
    expect(st().doc.items.length).toBe(2);
    st().undoAction();
    expect(st().doc.items.map((i) => i.label)).toEqual(['Min lokale']);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).items.length).toBe(1);
  });
});

describe('commit()-invariant (issue #1)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('alle commit-gående actions opdaterer doc i state OG localStorage', () => {
    const st = () => useApp.getState();
    const itemId = st().addItem({ label: 'X' });
    st().updateItem(itemId, { label: 'Y' });
    st().setItemColor(itemId, '#ff0000');
    st().addRelation(itemId, st().addItem({ label: 'Z' }), 'rel');
    st().addDependency(itemId, st().addItem({ label: 'W' }), 'FS');
    st().saveFilter('f1', { text: 'a' } as never);

    const persisted = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(persisted).toEqual(st().doc); // state og lager skal altid være ens
  });
});

// **** Issue #7: setSpan med ugyldig dato → fejl i errors-map, raawærdi bevaret, ingen korruption ****
describe('setSpan validering (#7)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    useApp = await freshStore();
  });

  it('ugyldig dag → errors[id] sat og span starter som indtastet', () => {
    const id = useApp.getState().addItem({ typeId: 'event', label: 'X' });
    useApp.getState().setSpan(id, { start: { y: 2024, mo: 2, d: 31, precision: 'day' } });
    expect(useApp.getState().errors[id]).toBeTruthy();
    const it = useApp.getState().doc.items.find((i) => i.id === id)!;
    expect(it.span.start).toEqual({ y: 2024, mo: 2, d: 31, precision: 'day' }); // raaværdi, ej rullet til mar
  });

  it('gyldig dato → fejl fjernet igen', () => {
    const id = useApp.getState().addItem({ typeId: 'event', label: 'Y' });
    useApp.getState().setSpan(id, { start: { y: 2024, mo: 2, d: 31, precision: 'day' } });
    expect(useApp.getState().errors[id]).toBeTruthy();
    useApp.getState().setSpan(id, { start: { y: 2024, mo: 2, d: 28, precision: 'day' } });
    expect(useApp.getState().errors[id]).toBeUndefined();
  });
});
