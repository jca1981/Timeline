// **** Zustand-store: lokal-first persistence (localStorage nu, IndexedDB senere) + sync-regler ****
import { create } from 'zustand';
import type { Span } from './core/types';
import { syncSpan } from './core/sync';
import {
  DEFAULT_RELATION_TYPES,
  emptyDoc,
  newId,
  type Item,
  type Relation,
  type TimelineDoc,
  type VerseRef,
} from './model/doc';

const LS_KEY = 'aeon-clone:doc:v1';

function loadDoc(): TimelineDoc {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const doc = JSON.parse(raw) as TimelineDoc;
      // migration: ældre M1-dokumenter får relations-felter
      doc.relationTypes ??= DEFAULT_RELATION_TYPES;
      doc.relations ??= [];
      return doc;
    }
  } catch {
    /*_corrupt → start ny */
  }
  return emptyDoc();
}

function persist(doc: TimelineDoc) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(doc));
  } catch {
    /* fyldt op — ignorerer i M1 */
  }
}

interface AppState {
  doc: TimelineDoc;
  errors: Record<string, string>; // itemId -> sync-fejl (rød kant)
  selectedId: string | null; // inspektør-valgt post
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
}

export const useApp = create<AppState>((set, get) => ({
  doc: loadDoc(),
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
}));
