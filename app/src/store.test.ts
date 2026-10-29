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
