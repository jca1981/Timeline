// **** Spreadsheet-view (M1+M4+M5+M6): entry, dato-sync, træ-hierarki, tags, drag-reorder ****
import { useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { formatSpan } from '../core/format';
import { applyFilter } from '../core/filters';
import { buildTree, checkParentRanges, flattenTree } from '../core/hierarchy';
import type { Item } from '../model/doc';
import { DateValueEditor, DurationEditor } from './DateFields';
import { demoDoc } from '../model/doc';

type SortMode = 'manual' | 'chrono' | 'tree';

export function SpreadsheetView() {
  const doc = useApp((s) => s.doc);
  const errors = useApp((s) => s.errors);
  const { addItem, clearAll } = useApp();

  const activeFilter = useApp((s) => s.activeFilter);
  const [sortMode, setSortMode] = useState<SortMode>('chrono');
  const dragId = useRef<string | null>(null);

  const hasHierarchy = doc.items.some((it) => it.parentId);

  // parent-range warnings
  const rangeWarnings = useMemo(() => checkParentRanges(doc), [doc]);
  const warningMap = useMemo(() => new Map(rangeWarnings.map((w) => [w.itemId, w.message])), [rangeWarnings]);

  // rows by sort mode
  const rows: Item[] = useMemo(() => {
    if (sortMode === 'tree' && hasHierarchy) {
      const tree = buildTree(doc.items);
      return flattenTree(tree).map((n) => n.item);
    }
    if (sortMode === 'chrono') {
      return [...doc.items].sort((a, b) => (a.span.start?.y ?? 9999) - (b.span.start?.y ?? 9999));
    }
    // manual: keep doc.items array order as-is
    return doc.items;
  }, [doc.items, sortMode, hasHierarchy]);

  const filtered = useMemo(() => applyFilter(rows, activeFilter), [rows, activeFilter]);

  // depth map (for indentation in tree mode)
  const depthMap = useMemo(() => {
    if (sortMode !== 'tree') return new Map<string, number>();
    const tree = buildTree(doc.items);
    return new Map(flattenTree(tree).map((n) => [n.item.id, n.depth]));
  }, [doc.items, sortMode]);

  // Drag-reorder helpers (manual mode only)
  const canDrag = sortMode === 'manual';
  function onDragStart(e: React.DragEvent, id: string) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const srcId = dragId.current;
    if (!srcId || srcId === targetId) return;
    useApp.setState((state) => {
      const items = [...state.doc.items];
      const srcIdx = items.findIndex((it) => it.id === srcId);
      const tgtIdx = items.findIndex((it) => it.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0) return state;
      const [moved] = items.splice(srcIdx, 1);
      items.splice(tgtIdx, 0, moved);
      return { doc: { ...state.doc, items } };
    });
    dragId.current = null;
  }

  return (
    <div>
      <div className="toolbar">
        <button className="primary" onClick={() => addItem()}>+ Tilføj post</button>
        <button onClick={() => useApp.setState({ doc: demoDoc(), selectedId: null })}>Indlæs bibel-demo</button>
        <button className="danger" onClick={clearAll}>Ryd alt</button>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} title="Sorteringsrækkefølge">
          <option value="chrono">📅 Kronologisk</option>
          <option value="tree">🌲 Hierarki</option>
          <option value="manual">↕️ Manuel (træk)</option>
        </select>
        {rangeWarnings.length > 0 && <span className="warn" title="Børn uden for forælder-tidsramme">⚠️ {rangeWarnings.length} range-advarsel{rangeWarnings.length > 1 ? 'er' : ''}</span>}
        <span className="count">{doc.items.length} poster</span>
      </div>
      <table className="sheet">
        <thead>
          <tr>
            <th></th>
            {canDrag && <th title="Træk rækker for at omarrangere">≡</th>}
            <th>Etiket</th>
            <th>Type</th>
            <th>Tags</th>
            <th>Start</th>
            <th>Varighed</th>
            <th>Tidsramme (auto)</th>
            <th>Usikker</th>
            <th>Fortsat</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it) => (
            <Row
              key={it.id}
              item={it}
              error={errors[it.id]}
              depth={depthMap.get(it.id) ?? 0}
              rangeWarn={warningMap.get(it.id)}
              canDrag={canDrag}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={canDrag ? 11 : 10} className="empty">Ingen poster endnu — tryk "+ Tilføj post" eller "Indlæs bibel-demo".</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ item, error, depth, rangeWarn, canDrag, onDragStart, onDragOver, onDrop }: {
  item: Item; error?: string; depth: number; rangeWarn?: string;
  canDrag: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}) {
  const doc = useApp((s) => s.doc);
  const { updateItem, setSpan, removeItem, duplicateItem } = useApp();
  const selected = useApp((s) => s.selectedId) === item.id;
  const select = useApp((s) => s.select);
  const type = doc.itemTypes.find((t) => t.id === item.typeId) ?? doc.itemTypes[0];
  const span = item.span;

  return (
    <tr
      className={`${error ? 'err' : ''} ${selected ? 'sel' : ''} ${rangeWarn ? 'range-warn' : ''}`}
      onClick={() => select(item.id)}
      draggable={canDrag}
      onDragStart={canDrag ? (e) => onDragStart(e, item.id) : undefined}
      onDragOver={canDrag ? onDragOver : undefined}
      onDrop={canDrag ? (e) => onDrop(e, item.id) : undefined}
    >
      <td>
        <span className="dot" style={{ background: item.color ?? type?.color ?? '#888' }} title={error ?? rangeWarn ?? type?.name} />
      </td>
      {canDrag && <td className="drag-handle">≡</td>}
      <td style={{ paddingLeft: `${depth * 1.2}em` }}>
        {depth > 0 && <span className="tree-prefix">└ </span>}
        <input className="label" value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} />
        {item.verseRefs?.length ? <span className="versebadge" title={`${item.verseRefs.length} vers-link(s)`}>📖{item.verseRefs.length}</span> : null}
        {rangeWarn && <span className="warn" title={rangeWarn}> ⚠️</span>}
      </td>
      <td>
        <select value={item.typeId} onChange={(e) => updateItem(item.id, { typeId: e.target.value })}>
          {doc.itemTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </td>
      <td className="tags-cell">
        {item.tags?.slice(0, 3).map((t) => <span key={t} className="tag-badge">{t}</span>) ?? ''}
        {item.tags && item.tags.length > 3 && <span className="tag-more">+{item.tags.length - 3}</span>}
      </td>
      <td>
        <DateValueEditor value={span.start} onChange={(v) => setSpan(item.id, { ...span, start: v, ongoing: false })} />
      </td>
      <td>
        <DurationEditor value={span.duration} disabled={span.ongoing} onChange={(v) => setSpan(item.id, { ...span, duration: v, ongoing: false })} />
      </td>
      <td className="range" title={error}>
        {formatSpan(span)}
        {span.uncertain && <span className="tilde"> ~</span>}
      </td>
      <td>
        <input type="checkbox" checked={!!span.uncertain} onChange={(e) => setSpan(item.id, { ...span, uncertain: e.target.checked ? (span.uncertain ?? {}) : undefined })} />
      </td>
      <td>
        <input type="checkbox" checked={!!span.ongoing} onChange={(e) => setSpan(item.id, { ...span, ongoing: e.target.checked })} />
      </td>
      <td className="rowbtns">
        <button onClick={(e) => { e.stopPropagation(); duplicateItem(item.id); }} title="Dupliér">⧉</button>
        <button className="danger" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} title="Slet">✕</button>
      </td>
    </tr>
  );
}
