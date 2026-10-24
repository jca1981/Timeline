// **** Zustand-store: lokal-first persistence (IndexedDB + localStorage-fallback) ****
import { create } from 'zustand';
import type { Span } from './core/types';
import { syncSpan } from './core/sync';
import { saveDoc, loadDoc as idbLoad } from './core/persist';
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
}

/** Hydrate fra IndexedDB (kaldes én gang efter mount). */
export async function hydrateStore() {
  const doc = await idbLoad<TimelineDoc>();
  if (doc) {
    doc.relationTypes ??= DEFAULT_RELATION_TYPES;
    doc.relations ??= [];
    doc.dependencies ??= [];
    doc.savedFilters ??= {};
    useApp.setState({ doc, errors: {}, selectedId: null });
  }
}

interface AppState {
  doc: TimelineDoc;
  errors: Record<string, string>; // itemId -> sync-fejl (rød kant)
  selectedId: string | null; // inspektør-valgt post
  activeFilter: Filter | null; // M4 aktivt filter
  select(id: string | null): void;
  addItem(partial?: Partial<Item>): string;
  updateItem(id: string, patch: Partial<Item>): void;
  setSpan(id: string, next: Span): void;
  removeItem(id: string): void;
  duplicateItem(id: string): void;
  clearAll(): void;
  importDoc(doc: TimelineDoc): void;
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
      const doc = { ...s.doc, items: [...s.doc.items, item] };
      persist(doc);
      return { doc };
    });
    return id;
  },

  updateItem: (id, patch) => {
    set((s) => {
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

  removeItem: (id) => {
    set((s) => {
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
      const doc = emptyDoc();
      persist(doc);
      return { doc, errors: {}, selectedId: null };
    });
  },

  importDoc: (doc) => {
    persist(doc);
    set({ doc, errors: {}, selectedId: null });
  },

  addRelation: (fromId, toId, typeId, note) => {
    if (fromId === toId) return; // ingen selvrelation
    const dup = (get().doc.relations ?? []).find((r) => r.typeId === typeId && r.fromId === fromId && r.toId === toId);
    if (dup) return;
    set((s) => {
      const rel: Relation = { id: newId(), fromId, toId, typeId, note };
      const doc = { ...s.doc, relations: [...(s.doc.relations ?? []), rel] };
      persist(doc);
      return { doc };
    });
  },

  removeRelation: (id) => {
    set((s) => {
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
      const dep: Dependency = { id, blockerId, blockedId, kind };
      const doc = { ...s.doc, dependencies: [...(s.doc.dependencies ?? []), dep] };
      persist(doc);
      return { doc };
    });
    return id;
  },

  removeDependency: (id) => {
    set((s) => {
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
      const doc = { ...s.doc, savedFilters: { ...(s.doc.savedFilters ?? {}), [name]: f } };
      persist(doc);
      return { doc };
    });
  },

  removeSavedFilter: (name) => {
    set((s) => {
      const sf = { ...(s.doc.savedFilters ?? {}) };
      delete sf[name];
      const doc = { ...s.doc, savedFilters: sf };
      persist(doc);
      return { doc };
    });
  },
}));
