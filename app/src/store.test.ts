// **** Store-tests (issue #1 + #11): commit()-vejen — UI, persist og undo hænger sammen ****
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineDoc } from './model/doc';

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

describe('fletning + valideret import + fortryd (review 03)', () => {
  let useApp: Awaited<ReturnType<typeof freshStore>>;
  let sanitizeImport: (raw: unknown) => { doc: TimelineDoc; skipped: number };
  const mk = (o: object): TimelineDoc =>
    ({ name: '', version: 1, itemTypes: [], relationTypes: [], relations: [], dependencies: [], sources: [], savedFilters: {}, ...o }) as unknown as TimelineDoc;
  beforeEach(async () => {
    useApp = await freshStore();
    const mod = await import('./store'); // samme post-reset-instans som freshStore lige har indlaest
    sanitizeImport = mod.sanitizeImport;
  });

  it('mergeDoc bevarer dependencies og relationTypes fra BOTH docs, dedup on id', async () => {
    const base = mk({
      items: [{ id: 'A', label: 'A', span: { start: { y: 1 }, end: { y: 2 } } }],
      dependencies: [{ id: 'd1', blockerId: 'A', blockedId: 'A', kind: 'FS' }],
      relationTypes: [{ id: 'rt1', name: 'Slægt', directed: false, inverseId: 'rt1' }],
    });
    useApp.getState().importDoc(base);
    const incoming = mk({
      items: [{ id: 'B', label: 'B', span: { start: { y: 3 }, end: { y: 4 } } }],
      dependencies: [
        { id: 'd1', blockerId: 'A', blockedId: 'A', kind: 'FS' }, // dup -> ignoreres
        { id: 'd2', blockerId: 'B', blockedId: 'B', kind: 'FF' },
      ],
      relationTypes: [
        { id: 'rt1', name: 'Slægt', directed: false, inverseId: 'rt1' }, // dup
        { id: 'rt2', name: 'Ven', directed: false, inverseId: 'rt2' },
      ],
    });
    useApp.getState().mergeDoc(incoming);
    const doc = useApp.getState().doc;
    expect(new Set(doc.items.map((i) => i.id))).toEqual(new Set(['A', 'B']));
    expect((doc.dependencies ?? []).map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    const rt = new Set((doc.relationTypes ?? []).map((t) => t.id));
    expect(rt.has('rt1') && rt.has('rt2')).toBe(true);
  });

  it('erstatnings-import kan fortrydes (rigtig Fortrod)', () => {
    const st = () => useApp.getState();
    st().importDoc(mk({ items: [{ id: 'v1', label: 'v1', span: { start: { y: 1 }, end: { y: 2 } } }] }));
    st().importDoc(mk({ items: [{ id: 'v2', label: 'v2', span: { start: { y: 5 }, end: { y: 6 } } }, { id: 'v2b', label: 'v2b', span: { start: { y: 7 }, end: { y: 8 } } }] }));
    expect(st().doc.items.map((i) => i.id)).toEqual(['v2', 'v2b']);
    st().undoAction();
    expect(st().doc.items.map((i) => i.id)).toEqual(['v1']); // tilbage foer erstatningen
  });

  it('sanitizeImport afviser ikke-arkiv og springer ugylde poster fra', () => {
    expect(() => sanitizeImport(null)).toThrow();
    expect(() => sanitizeImport({ foo: 1 })).toThrow();
    const { doc, skipped } = sanitizeImport({
      items: [
        { id: 'ok', label: 'OK', span: { start: { y: 10 }, end: { y: 11 } } },
        { id: 'noLabel' },
        null,
        { id: 'noSpan', label: 'X' },
      ],
    });
    expect(doc.items.map((i) => i.id)).toEqual(['ok']);
    expect(skipped).toBe(3);
  });

  it('importDoc gemmer den normaliserede doc i state (ikke raadata med manglende felter)', () => {
    useApp.getState().importDoc({ items: [], savedFilters: {} } as unknown as TimelineDoc);
    const doc = useApp.getState().doc;
    expect(Array.isArray(doc.itemTypes) && doc.itemTypes.length > 0).toBe(true);
    expect(Array.isArray(doc.relations)).toBe(true);
    expect(Array.isArray(doc.dependencies)).toBe(true);
  });
});
