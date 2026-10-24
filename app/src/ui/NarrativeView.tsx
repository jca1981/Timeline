// **** Narrativ/Outline-visning (M9+M11): læsevenlig kronologisk tekst, hierarkisk outline, billeder ****
import { useMemo } from 'react';
import { useApp } from '../store';
import { buildTree, flattenTree } from '../core/hierarchy';
import { formatUncertainty } from '../core/format';
import { ItemImage } from './ItemImage';
import type { Item } from '../model/doc';

function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const ya = a.span.start?.y ?? 0;
    const yb = b.span.start?.y ?? 0;
    if (ya !== yb) return ya - yb;
    return a.label.localeCompare(b.label);
  });
}

function fmtYear(y: number | undefined): string {
  if (y === undefined) return '?';
  if (y < 0) return `${-y} f.Kr.`;
  return `${y} e.Kr.`;
}

export function NarrativeView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const types = useMemo(() => {
    const m = new Map(doc.itemTypes.map((t) => [t.id, t]));
    return m;
  }, [doc.itemTypes]);

  // Build outline: top-level items sorted by chronology, with nested children
  const outline = useMemo(() => {
    const hasParent = doc.items.some((it) => it.parentId);
    if (hasParent) {
      const tree = buildTree(doc.items);
      const flat = flattenTree(tree);
      return flat;
    }
    return sortItems(doc.items).map((it) => ({ item: it, depth: 0 }));
  }, [doc.items]);

  // Fulfillment maps for inline annotations
  const fulfillMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of doc.relations ?? []) {
      if (r.typeId === 'rt-fulfillment') {
        map.set(r.fromId, [...(map.get(r.fromId) ?? []), r.toId]);
      }
    }
    return map;
  }, [doc.relations]);

  const fulfills = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of doc.relations ?? []) {
      if (r.typeId === 'rt-fulfillment') {
        map.set(r.toId, [...(map.get(r.toId) ?? []), r.fromId]);
      }
    }
    return map;
  }, [doc.relations]);

  // Group into "eras" by top-level entries (depth=0)
  const eras: Array<{ heading: Item; entries: typeof outline }> = [];
  let currentEra: typeof outline = [];
  for (const entry of outline) {
    if (entry.depth === 0) {
      if (currentEra.length > 0) eras.push({ heading: currentEra[0]!.item, entries: currentEra });
      currentEra = [entry];
    } else {
      currentEra.push(entry);
    }
  }
  if (currentEra.length > 0) eras.push({ heading: currentEra[0]!.item, entries: currentEra });

  // If only one "era" and no hierarchy, render flat
  const useFlat = eras.length <= 1 && !doc.items.some((it) => it.parentId);

  function renderItem(entry: { item: Item; depth: number }) {
    const it = entry.item;
    const type = types.get(it.typeId);
    const fulfilledBy = fulfillMap.get(it.id);
    const fulfilledFrom = fulfills.get(it.id);
    const isFulfilled = fulfilledBy && fulfilledBy.length > 0;
    const isFulfillment = fulfilledFrom && fulfilledFrom.length > 0;

    return (
      <div
        key={it.id}
        className={`narr-item depth-${entry.depth} ${selectedId === it.id ? 'narr-selected' : ''} ${isFulfillment ? 'narr-fulfillment' : ''} ${isFulfilled ? 'narr-prophecy' : ''}`}
        onClick={() => select(it.id)}
      >
        <span className="narr-date">{fmtYear(it.span.start?.y)}</span>
        <span className="narr-label">{it.label}</span>
        {type && <span className="narr-type" style={{ color: type.color }}>{type.name}</span>}
        {it.span.uncertain && <span className="narr-uncertain">{formatUncertainty(it.span)}</span>}
        {it.verseRefs && it.verseRefs.length > 0 && (
          <span className="narr-verse"> 📖{it.verseRefs.map((v) => `${v.bookSlug} ${v.ch}${v.vs ? ':' + v.vs : ''}`).join(', ')}</span>
        )}
        {isFulfilled && (
          <span className="narr-arrow"> → 📜 {fulfilledBy!.map((fid) => doc.items.find((x) => x.id === fid)?.label ?? '?').join(', ')}</span>
        )}
        {isFulfillment && !isFulfilled && (
          <span className="narr-fulfilled-by"> ← 📜 opfylder: {fulfilledFrom!.map((fid) => doc.items.find((x) => x.id === fid)?.label ?? '?').join(', ')}</span>
        )}
        {it.tags && it.tags.length > 0 && (
          <span className="narr-tags"> {it.tags.map((t) => `#${t}`).join(' ')}</span>
        )}
        {it.notes && <div className="narr-notes">{it.notes}</div>}
        {it.imageId && <ItemImage imageId={it.imageId} size={180} />}
      </div>
    );
  }

  return (
    <div className="narrative-view">
      <div className="narrative-header">
        <h2>{doc.name}</h2>
        <p className="narr-meta">{doc.items.length} poster · {doc.relations?.length ?? 0} relationer</p>
      </div>

      <div className="narrative-body">
        {useFlat ? (
          <div className="narrative-flat">
            {outline.map((e) => renderItem(e))}
          </div>
        ) : (
          eras.map((era, i) => (
            <section key={i} className="narr-era">
              <h3 className="narr-era-heading" onClick={() => select(era.heading.id)}>
                {fmtYear(era.heading.span.start?.y)} – {era.heading.label}
              </h3>
              {era.entries.map((e) => renderItem(e))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
