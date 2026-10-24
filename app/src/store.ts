// **** Zustand-store: lokal-first persistence (IndexedDB + localStorage-fallback) ****
import { create } from 'zustand';
import type { Span } from './core/types';
import { syncSpan } from './core/sync';
import { saveDoc, loadDoc as idbLoad, saveDocById, loadDocById, deleteDocById, listDocs, type DocMeta } from './core/persist';
import { pushSnapshot, undo as histUndo, redo as histRedo, clearHistory } from './core/history';
import {
  DEFAULT_RELATION_TYPES,
  emptyDoc,
  newId,
  type Dependency,
  type DepKind,
  type Filter,
  type Item,
  type Relation,
  type TimelineDoc,
  type VerseRef,
} from './model/doc';

const LS_KEY = 'aeon-clone:doc:v1';
const LS_DOCID = 'aeon-clone:docId:v1';

function getDocId(): string {
  return localStorage.getItem(LS_DOCID) || DOC_KEY;
}
function setDocId(id: string) {
  try { localStorage.setItem(LS_DOCID, id); } catch { /* */ }
}
const DOC_KEY = 'current';

/** Sync initial load (localStorage som lynhurtig cache; IndexedDB hydrates senere). */
function loadDocSync(): TimelineDoc {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const doc = JSON.parse(raw) as TimelineDoc;
      doc.relationTypes ??= DEFAULT_RELATION_TYPES;
      doc.relations ??= [];
      doc.dependencies ??= [];
      doc.savedFilters ??= {};
      return doc;
    }
  } catch { /* corrupt → start ny */ }
  return emptyDoc();
}

/** Async persist (IndexedDB + localStorage cache). Fire-and-forget. */
function persist(doc: TimelineDoc) {
  // localStorage som sync cache (instant genindlæsning næste gang)
  try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch { /* ignorer */ }
  // IndexedDB som primær lager (større dokumenter)
  saveDoc(doc).catch(() => {});
  // Also save by docId for multi-doc
  const id = getDocId();
  if (id !== DOC_KEY) saveDocById(id, doc, doc.name).catch(() => {});
}

/** Hydrate fra IndexedDB (kaldes én gang efter mount). */
export async function hydrateStore() {
  const id = getDocId();
  let doc: TimelineDoc | null = null;
  if (id !== DOC_KEY) {
    doc = await loadDocById<TimelineDoc>(id);
  }
  if (!doc) doc = await idbLoad<TimelineDoc>();
  if (doc) {
    doc.relationTypes ??= DEFAULT_RELATION_TYPES;
    doc.relations ??= [];
    doc.dependencies ??= [];
    doc.savedFilters ??= {};
    useApp.setState({ doc, errors: {}, selectedId: null });
  }
  // Load doc list
  const list = await listDocs();
  useApp.setState({ docList: list });
}

interface AppState {
  doc: TimelineDoc;
  errors: Record<string, string>; // itemId -> sync-fejl (rød kant)
  selectedId: string | null; // inspektør-valgt post
  activeFilter: Filter | null; // M4 aktivt filter
  docList: DocMeta[]; // M9 multi-doc profiles
  select(id: string | null): void;
  addItem(partial?: Partial<Item>): string;
  updateItem(id: string, patch: Partial<Item>): void;
  setSpan(id: string, next: Span): void;
  setItemColor(id: string, color: string): void;
  removeItem(id: string): void;
  duplicateItem(id: string): void;
  clearAll(): void;
  importDoc(doc: TimelineDoc): void;
  mergeDoc(incoming: TimelineDoc): void;
  addRelation(fromId: string, toId: string, typeId: string, note?: string): void;
  removeRelation(id: string): void;
  toggleRelation(fromId: string, toId: string, typeId: string): void;
  setVerseRefs(id: string, refs: VerseRef[]): void;
  // M4: Dependencies
  addDependency(blockerId: string, blockedId: string, kind: DepKind): string | null;
  removeDependency(id: string): void;
  // M4: Filtre
  setFilter(f: Filter | null): void;
  saveFilter(name: string, f: Filter): void;
  removeSavedFilter(name: string): void;
  // M9: Multi-doc
  newDoc(name?: string): void;
  switchDoc(id: string): Promise<void>;
  deleteDoc(id: string): Promise<void>;
  saveAsDoc(name: string): Promise<void>;
  refreshDocList(): Promise<void>;
  // M10: Undo/Redo
  undoAction(): void;
  redoAction(): void;
  // M12: Overskuelighed
  collapsedIds: Set<string>;
  toggleCollapse(id: string): void;
  jumpTarget: string | null; // itemId at zoome til (forbruges af TimelineView)
  jumpTo(itemId: string): void;
  clearJump(): void;
  pinnedIds: Set<string>;
  togglePin(id: string): void;
  // M19: Multi-select
  multiSelected: Set<string>;
  toggleMulti(id: string): void;
  clearMulti(): void;
  // M23: Clipboard
  clipboard: Item[];
  copyItems(ids: string[]): void;
  pasteClipboard(): void;
}

export const useApp = create<AppState>((set, get) => ({
  doc: loadDocSync(),
  errors: {},
  selectedId: null,
  select: (id) => set({ selectedId: id }),

  addItem: (partial) => {
    const id = newId();
    const type = get().doc.itemTypes[0];
    const item: Item = { id, typeId: type.id, label: 'Ny post', span: { start: { y: new Date().getFullYear(), precision: 'year' } }, ...partial };
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, items: [...s.doc.items, item] };
      persist(doc);
      return { doc };
    });
    return id;
  },

  updateItem: (id, patch) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, items: s.doc.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
      persist(doc);
      return { doc };
    });
  },

  setSpan: (id, next) => {
    const r = syncSpan(next);
    if (r.error) {
      set((s) => ({ errors: { ...s.errors, [id]: r.error! } }));
      // gem uanset (rå værdi), så brugeren kan rette feltet — markerer rød
      get().updateItem(id, { span: next });
      return;
    }
    set((s) => {
      const errors = { ...s.errors };
      delete errors[id];
      const doc = { ...s.doc, items: s.doc.items.map((it) => (it.id === id ? { ...it, span: r.span! } : it)) };
      persist(doc);
      return { doc, errors };
    });
  },

  setItemColor: (id, color) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, items: s.doc.items.map((it) => (it.id === id ? { ...it, color } : it)) };
      persist(doc);
      return { doc };
    });
  },

  removeItem: (id) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = {
        ...s.doc,
        items: s.doc.items.filter((it) => it.id !== id).map((it) => (it.parentId === id ? { ...it, parentId: undefined } : it)),
        relations: (s.doc.relations ?? []).filter((r) => r.fromId !== id && r.toId !== id),
        dependencies: (s.doc.dependencies ?? []).filter((d) => d.blockerId !== id && d.blockedId !== id),
      };
      persist(doc);
      return { doc, selectedId: s.selectedId === id ? null : s.selectedId };
    });
  },

  duplicateItem: (id) => {
    const src = get().doc.items.find((it) => it.id === id);
    if (!src) return;
    const { id: _drop, ...rest } = src;
    get().addItem({ ...rest, label: `${src.label} (kopi)` });
  },

  clearAll: () => {
    set(() => {
      pushSnapshot(get().doc);
      const doc = emptyDoc();
      persist(doc);
      clearHistory(); // fresh start for new doc
      return { doc, errors: {}, selectedId: null };
    });
  },

  importDoc: (doc) => {
    pushSnapshot(get().doc);
    clearHistory();
    persist(doc);
    set({ doc, errors: {}, selectedId: null });
  },

  mergeDoc: (incoming: TimelineDoc) => {
    pushSnapshot(get().doc);
    const s = get();
    const existingIds = new Set(s.doc.items.map((i) => i.id));
    const newItems = incoming.items.filter((i) => !existingIds.has(i.id));
    const existingRelIds = new Set((s.doc.relations ?? []).map((r) => r.id));
    const newRels = (incoming.relations ?? []).filter((r) => !existingRelIds.has(r.id));
    const existingTypeIds = new Set(s.doc.itemTypes.map((t) => t.id));
    const newTypes = (incoming.itemTypes ?? []).filter((t) => !existingTypeIds.has(t.id));
    const merged: TimelineDoc = {
      ...s.doc,
      items: [...s.doc.items, ...newItems],
      relations: [...(s.doc.relations ?? []), ...newRels],
      itemTypes: [...s.doc.itemTypes, ...newTypes],
    };
    persist(merged);
    set({ doc: merged });
  },

  addRelation: (fromId, toId, typeId, note) => {
    if (fromId === toId) return; // ingen selvrelation
    const dup = (get().doc.relations ?? []).find((r) => r.typeId === typeId && r.fromId === fromId && r.toId === toId);
    if (dup) return;
    set((s) => {
      pushSnapshot(s.doc);
      const rel: Relation = { id: newId(), fromId, toId, typeId, note };
      const doc = { ...s.doc, relations: [...(s.doc.relations ?? []), rel] };
      persist(doc);
      return { doc };
    });
  },

  removeRelation: (id) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, relations: (s.doc.relations ?? []).filter((r) => r.id !== id) };
      persist(doc);
      return { doc };
    });
  },

  toggleRelation: (fromId, toId, typeId) => {
    const existing = (get().doc.relations ?? []).find((r) => r.typeId === typeId && r.fromId === fromId && r.toId === toId);
    if (existing) get().removeRelation(existing.id);
    else get().addRelation(fromId, toId, typeId);
  },

  setVerseRefs: (id, refs) => {
    get().updateItem(id, { verseRefs: refs.length ? refs : undefined });
  },

  // ---- M4: Dependencies ----
  addDependency: (blockerId, blockedId, kind) => {
    const doc = get().doc;
    const err = doc.items.find((it) => it.id === blockerId) && doc.items.find((it) => it.id === blockedId)
      ? (blockerId === blockedId ? 'selv' : null)
      : 'mangler';
    if (err) return null;
    const dup = (doc.dependencies ?? []).find((d) => d.blockerId === blockerId && d.blockedId === blockedId && d.kind === kind);
    if (dup) return null;
    const id = newId();
    set((s) => {
      pushSnapshot(s.doc);
      const dep: Dependency = { id, blockerId, blockedId, kind };
      const doc = { ...s.doc, dependencies: [...(s.doc.dependencies ?? []), dep] };
      persist(doc);
      return { doc };
    });
    return id;
  },

  removeDependency: (id) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, dependencies: (s.doc.dependencies ?? []).filter((d) => d.id !== id) };
      persist(doc);
      return { doc };
    });
  },

  // ---- M4: Filtre ----
  activeFilter: null,
  setFilter: (f) => set({ activeFilter: f }),

  saveFilter: (name, f) => {
    set((s) => {
      pushSnapshot(s.doc);
      const doc = { ...s.doc, savedFilters: { ...(s.doc.savedFilters ?? {}), [name]: f } };
      persist(doc);
      return { doc };
    });
  },

  removeSavedFilter: (name) => {
    set((s) => {
      pushSnapshot(s.doc);
      const sf = { ...(s.doc.savedFilters ?? {}) };
      delete sf[name];
      const doc = { ...s.doc, savedFilters: sf };
      persist(doc);
      return { doc };
    });
  },

  // ---- M9: Multi-doc profiles ----
  docList: [],

  newDoc: (name) => {
    pushSnapshot(get().doc);
    const doc = emptyDoc(name || 'Nyt tidslinje');
    persist(doc);
    set({ doc, errors: {}, selectedId: null, activeFilter: null });
  },

  switchDoc: async (id) => {
    // Save current first
    const cur = get().doc;
    persist(cur);
    clearHistory();
    // Load the target
    const doc = await loadDocById<TimelineDoc>(id);
    if (!doc) return;
    doc.relationTypes ??= DEFAULT_RELATION_TYPES;
    doc.relations ??= [];
    doc.dependencies ??= [];
    doc.savedFilters ??= {};
    setDocId(id);
    set({ doc, errors: {}, selectedId: null, activeFilter: null });
  },

  deleteDoc: async (id) => {
    await deleteDocById(id);
    const list = await listDocs();
    set({ docList: list });
    if (getDocId() === id) {
      // switched away — load current/first
      setDocId(DOC_KEY);
      await hydrateStore();
    }
  },

  saveAsDoc: async (name) => {
    const id = newId();
    const cur = { ...get().doc, name };
    await saveDocById(id, cur, name);
    setDocId(id);
    const list = await listDocs();
    set({ doc: cur, docList: list });
  },

  refreshDocList: async () => {
    const list = await listDocs();
    set({ docList: list });
  },

  // ---- M10: Undo/Redo ----
  undoAction: () => {
    const cur = get().doc;
    const prev = histUndo(cur);
    if (!prev) return;
    persist(prev);
    set({ doc: prev, errors: {}, selectedId: null });
  },

  redoAction: () => {
    const cur = get().doc;
    const next = histRedo(cur);
    if (!next) return;
    persist(next);
    set({ doc: next, errors: {}, selectedId: null });
  },

  // M12: Overskuelighed
  collapsedIds: new Set<string>(),
  toggleCollapse: (id) => set((s) => {
    const next = new Set(s.collapsedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { collapsedIds: next };
  }),
  jumpTarget: null,
  jumpTo: (itemId) => set({ jumpTarget: itemId }),
  clearJump: () => set({ jumpTarget: null }),
  pinnedIds: new Set<string>(),
  togglePin: (id) => set((s) => {
    const next = new Set(s.pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { pinnedIds: next };
  }),
  multiSelected: new Set<string>(),
  toggleMulti: (id) => set((s) => {
    const next = new Set(s.multiSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { multiSelected: next };
  }),
  clearMulti: () => set({ multiSelected: new Set<string>() }),

  // M23: Clipboard
  clipboard: [],
  copyItems: (ids) => {
    const items = get().doc.items.filter((it) => ids.includes(it.id));
    set({ clipboard: JSON.parse(JSON.stringify(items)) });
  },
  pasteClipboard: () => {
    const cbs = get().clipboard;
    if (!cbs.length) return;
    set((s) => {
      pushSnapshot(s.doc);
      const newItems = cbs.map((it) => ({ ...it, id: newId() }));
      const doc = { ...s.doc, items: [...s.doc.items, ...newItems] };
      persist(doc);
      return { doc };
    });
  },
}));
