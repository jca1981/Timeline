// **** Timeline-view (M2+M4+M12+M13): zoombar tidslinje + sidebar + collapse + søg + klynger + minimap + type-lanes + tastatur ****
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { formatSpan, formatUncertainty } from '../core/format';
import { clampPx, contentBounds, spanBounds, ticksFor } from '../core/scale';
import { toJD, fromJD } from '../core/jdn';
import { applyFilter } from '../core/filters';
import { isDependencyViolated } from '../core/dependencies';
import { EntitySidebar } from './EntitySidebar';
import { ItemImage } from './ItemImage';
import type { Item } from '../model/doc';

interface Viewport {
  center: number; // JD i midten
  px: number; // pixels pr. dag
}

const ROW_H = 28;
const CLUSTER_THRESHOLD = 4;
const MINIMAP_H = 20;

type LaneMode = 'chrono' | 'type';

export function TimelineView() {
  const doc = useApp((s) => s.doc);
  const select = useApp((s) => s.select);
  const selectedId = useApp((s) => s.selectedId);
  const collapsedIds = useApp((s) => s.collapsedIds);
  const toggleCollapse = useApp((s) => s.toggleCollapse);
  const jumpTarget = useApp((s) => s.jumpTarget);
  const clearJump = useApp((s) => s.clearJump);
  const jumpTo = useApp((s) => s.jumpTo);
  const pinnedIds = useApp((s) => s.pinnedIds);
  const togglePin = useApp((s) => s.togglePin);
  const multiSelected = useApp((s) => s.multiSelected);
  const toggleMulti = useApp((s) => s.toggleMulti);
  const clearMulti = useApp((s) => s.clearMulti);
  const duplicateItem = useApp((s) => s.duplicateItem);
  const addItemAction = useApp((s) => s.addItem);
  const wrapRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [vp, setVp] = useState<Viewport>({ center: 1730000, px: 1 / 40 });
  const vpRef = useRef(vp);
  vpRef.current = vp;

  // Søg & hoppe
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);

  // M13: type-lane mode
  const [laneMode, setLaneMode] = useState<LaneMode>('chrono');

  // M16: Detail-popup + hover-relateret
  const [popupId, setPopupId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // M18: Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  // M22: Inline editing
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const updateItem = useApp((s) => s.updateItem);
  const removeItem = useApp((s) => s.removeItem);
  const setItemColor = useApp((s) => s.setItemColor);
  const activeFilter = useApp((s) => s.activeFilter);
  const setFilter = useApp((s) => s.setFilter);

  // M18: Close ctx menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  // mål bredde
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const cb = contentBounds(doc.items.map((i) => i.span));
    if (!cb || !width) return;
    const span = cb.right - cb.left;
    setVp({ center: (cb.left + cb.right) / 2, px: clampPx((width - 80) / span) });
  }, [doc.items, width]);

  // fit når indhold eller bredde ændrer sig første gang
  const fittedKey = useRef('');
  useEffect(() => {
    const key = `${doc.items.length}:${width}`;
    if (fittedKey.current !== key && width > 0) {
      fittedKey.current = key;
      fit();
    }
  }, [doc.items.length, width, fit]);

  // Jump-to reacting
  useEffect(() => {
    if (!jumpTarget) return;
    const item = doc.items.find((i) => i.id === jumpTarget);
    if (item) {
      const bd = spanBounds(item.span);
      if (bd) {
        setVp((v) => ({ center: (bd.a + bd.b) / 2, px: Math.max(v.px, 0.01) }));
        select(jumpTarget);
      }
    }
    clearJump();
  }, [jumpTarget, doc.items, select, clearJump]);

  const left = vp.center - width / 2 / vp.px;
  const right = vp.center + width / 2 / vp.px;
  const x = useCallback((jd: number) => (jd - left) * vp.px, [left, vp.px]);

  // Search handler
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const q = searchQ.toLowerCase().trim();
    const matches = doc.items.filter((it) =>
      it.label.toLowerCase().includes(q) || (it.notes ?? '').toLowerCase().includes(q)
    ).slice(0, 10);
    setSearchResults(matches);
  }, [searchQ, doc.items]);

  // M13: Tastatur navigation (Ctrl+←/→, +/− zoom)
  const rowsRef = useRef<{ it: Item; bd: NonNullable<ReturnType<typeof spanBounds>>; y: number }[]>([]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip hvis i input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const rows = rowsRef.current;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const curIdx = rows.findIndex((r) => r.it.id === selectedId);
          const nextIdx = curIdx < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, curIdx + dir));
          if (rows[nextIdx]) {
            const bd = rows[nextIdx].bd;
            setVp((v) => ({ center: (bd.a + bd.b) / 2, px: Math.max(v.px, 0.01) }));
            select(rows[nextIdx].it.id);
          }
        } else if (e.key === 'd' && selectedId) {
          e.preventDefault();
          duplicateItem(selectedId);
        } else if (e.key === 'c' && selectedId) {
          e.preventDefault();
          const ids = multiSelected.size > 0 ? [...multiSelected] : [selectedId];
          useApp.getState().copyItems(ids);
        } else if (e.key === 'v') {
          e.preventDefault();
          useApp.getState().pasteClipboard();
        }
      } else if (e.key === '+' || e.key === '=') {
        setVp((v) => ({ ...v, px: clampPx(v.px * 1.4) }));
      } else if (e.key === '-' || e.key === '_') {
        setVp((v) => ({ ...v, px: clampPx(v.px / 1.4) }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, select, duplicateItem]);

  // hjul-zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pxX = e.clientX - rect.left;
      setVp((v) => {
        const factor = Math.pow(1.0015, -e.deltaY);
        const npx = clampPx(v.px * factor);
        const l = v.center - rect.width / 2 / v.px;
        const jdAtCursor = l + pxX / v.px;
        const nl = jdAtCursor - pxX / npx;
        return { center: nl + rect.width / 2 / npx, px: npx };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // pan med træk
  const drag = useRef<{ x: number; center: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.bar') || (e.target as HTMLElement).closest('.cluster') || (e.target as HTMLElement).closest('.minimap')) return;
      drag.current = { x: e.clientX, center: vpRef.current.center };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      setVp((v) => ({ ...v, center: drag.current!.center - dx / v.px }));
    };
    const up = () => (drag.current = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, []);

  const ticks = useMemo(() => ticksFor(left, right, vp.px), [left, right, vp.px]);

  // ---- Rows med collapse + klynger + lanes ----

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const it of doc.items) {
      if (it.parentId) {
        const arr = map.get(it.parentId) ?? [];
        arr.push(it.id);
        map.set(it.parentId, arr);
      }
    }
    return map;
  }, [doc.items]);

  // M21: Descendant count per item (recursive)
  const descCount = useMemo(() => {
    const map = new Map<string, number>();
    const count = (id: string): number => {
      if (map.has(id)) return map.get(id)!;
      const kids = childrenMap.get(id) ?? [];
      let total = kids.length;
      for (const k of kids) total += count(k);
      map.set(id, total);
      return total;
    };
    for (const [pid] of childrenMap) count(pid);
    return map;
  }, [childrenMap]);

  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    const stack: string[] = [];
    for (const id of collapsedIds) {
      if (id.startsWith('grp:') || id.startsWith('tag:')) continue;
      stack.push(id);
    }
    while (stack.length) {
      const pid = stack.pop()!;
      for (const cid of childrenMap.get(pid) ?? []) {
        hidden.add(cid);
        stack.push(cid);
      }
    }
    return hidden;
  }, [collapsedIds, childrenMap]);

  // M15: Color inheritance — children without own color get parent’s color
  const effectiveColor = useMemo(() => {
    const typeMap = new Map(doc.itemTypes.map((t) => [t.id, t.color]));
    const itemMap = new Map(doc.items.map((it) => [it.id, it]));
    const cache = new Map<string, string>();
    function resolve(id: string): string {
      if (cache.has(id)) return cache.get(id)!;
      const it = itemMap.get(id);
      if (!it) return '#888';
      const own = it.color ?? typeMap.get(it.typeId) ?? '#888';
      // Use own color if explicitly set (not just type default)
      if (it.color) { cache.set(id, it.color); return it.color; }
      // Otherwise inherit from parent
      if (it.parentId && itemMap.has(it.parentId)) {
        const pc = resolve(it.parentId);
        cache.set(id, pc);
        return pc;
      }
      cache.set(id, own);
      return own;
    }
    for (const it of doc.items) resolve(it.id);
    return cache;
  }, [doc.items, doc.itemTypes]);

  // M16: Related items (parent + children + siblings) for hover highlight
  const relatedIds = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const set = new Set<string>();
    const itemMap = new Map(doc.items.map((it) => [it.id, it]));
    const h = itemMap.get(hoveredId);
    if (!h) return set;
    if (h.parentId) set.add(h.parentId);
    for (const cid of childrenMap.get(hoveredId) ?? []) set.add(cid);
    if (h.parentId) {
      for (const sibId of childrenMap.get(h.parentId) ?? []) { if (sibId !== hoveredId) set.add(sibId); }
    }
    return set;
  }, [hoveredId, doc.items, childrenMap]);

  const { rows, clusters, laneGroups, eraBands, datelessItems } = useMemo(() => {
    const filtered = applyFilter(doc.items, activeFilter).filter((it) => !hiddenByCollapse.has(it.id));
    const list = [...filtered]
      .map((it) => ({ it, bd: spanBounds(it.span) }))
      .filter((r): r is { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>> } => !!r.bd)
      .sort((a, b) => a.bd.a - b.bd.a || a.it.label.localeCompare(b.it.label));

    // Cluster detection
    const clustered = new Set<string>();
    const clusterList: { items: Item[]; x: number; y: number; count: number }[] = [];

    if (list.length > 10) {
      const groups: { items: Item[]; minA: number; maxB: number }[] = [];
      for (const r of list) {
        const cx = (r.bd.a + r.bd.b) / 2;
        let placed = false;
        for (const g of groups) {
          const gcx = (g.minA + g.maxB) / 2;
          const distPx = Math.abs(cx - gcx) * vp.px;
          if (distPx < 30) {
            g.items.push(r.it);
            g.minA = Math.min(g.minA, r.bd.a);
            g.maxB = Math.max(g.maxB, r.bd.b);
            placed = true;
            break;
          }
        }
        if (!placed) groups.push({ items: [r.it], minA: r.bd.a, maxB: r.bd.b });
      }
      for (const g of groups) {
        if (g.items.length >= CLUSTER_THRESHOLD && vp.px < 0.005) {
          const cx = (g.minA + g.maxB) / 2;
          for (const it of g.items) clustered.add(it.id);
          clusterList.push({ items: g.items, x: cx, y: 0, count: g.items.length });
        }
      }
    }

    const unclustered = list.filter((r) => !clustered.has(r.it.id));

    // Lane mode: group by type
    let lanes: { typeId: string; typeName: string; items: typeof unclustered }[] = [];
    if (laneMode === 'type') {
      const byType = new Map<string, typeof unclustered>();
      for (const r of unclustered) {
        const arr = byType.get(r.it.typeId) ?? [];
        arr.push(r);
        byType.set(r.it.typeId, arr);
      }
      lanes = doc.itemTypes
        .filter((t) => (byType.get(t.id)?.length ?? 0) > 0)
        .map((t) => ({ typeId: t.id, typeName: t.name, items: byType.get(t.id)! }));
    }

    // Assign y-positions
    let yPos = 0;
    type Row = { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>>; y: number };
    let positioned: Row[];
    const laneInfo: { typeName: string; y: number; count: number; color: string }[] = [];

    if (laneMode === 'type' && lanes.length > 1) {
      positioned = [];
      for (const lane of lanes) {
        const type = doc.itemTypes.find((t) => t.id === lane.typeId);
        laneInfo.push({ typeName: lane.typeName, y: yPos, count: lane.items.length, color: type?.color ?? '#888' });
        for (const r of lane.items) {
          positioned.push({ ...r, y: yPos * ROW_H });
          yPos++;
        }
        yPos++; // gap between lanes
      }
    } else {
      // M24: Greedy bin-packing — pack non-overlapping items in same row
      const packed: { it: Item; bd: NonNullable<ReturnType<typeof spanBounds>>; y: number }[] = [];
      const rowEnds: number[] = []; // end x-jd for each row
      for (const r of unclustered) {
        let placed = false;
        for (let row = 0; row < rowEnds.length; row++) {
          if (r.bd.a > rowEnds[row]) {
            packed.push({ ...r, y: row * ROW_H });
            rowEnds[row] = r.bd.b;
            placed = true;
            break;
          }
        }
        if (!placed) {
          packed.push({ ...r, y: rowEnds.length * ROW_H });
          rowEnds.push(r.bd.b);
        }
      }
      positioned = packed;
    }

    rowsRef.current = positioned;

    // M14: Era bands — parent items with many descendants + long span
    const ERA_MIN_DESC = 3;
    const ERA_MIN_SPAN_DAYS = 18250; // 50 years
    const eras: { id: string; label: string; a: number; b: number; color: string }[] = [];
    for (const it of doc.items) {
      const kids = childrenMap.get(it.id);
      if (!kids || kids.length < ERA_MIN_DESC) continue;
      const bd = spanBounds(it.span);
      if (!bd) continue;
      if (bd.b - bd.a < ERA_MIN_SPAN_DAYS) continue;
      const type = doc.itemTypes.find((t) => t.id === it.typeId);
      eras.push({ id: it.id, label: it.label, a: bd.a, b: bd.b, color: it.color ?? type?.color ?? '#888' });
    }

    // M14: Dateless items (no valid date bounds)
    const dless = applyFilter(doc.items, activeFilter).filter((it) => !hiddenByCollapse.has(it.id) && !spanBounds(it.span));

    return { rows: positioned, clusters: clusterList, laneGroups: laneInfo, eraBands: eras, datelessItems: dless };
  }, [doc.items, doc.itemTypes, activeFilter, hiddenByCollapse, vp.px, laneMode]);

  const visible = rows.filter((r) => x(r.bd.b) > -200 && x(r.bd.a) < width + 200);
  const hidden = rows.length - visible.length;

  // M17: Era breadcrumb — which eras contain current viewport center?
  const viewportCenterJD = vp.center;
  const activeEras = eraBands.filter((e) => e.a <= viewportCenterJD && e.b >= viewportCenterJD);

  // M17: Vertical connectors (parent → children y-midpoints)
  const rowYMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.it.id, r.y + ROW_H / 2);
    return m;
  }, [rows]);

  // ---- Minimap helpers ----
  const contentBd = useMemo(() => contentBounds(doc.items.map((i) => i.span)), [doc.items]);
  const totalRows = rows.length;

  function minimapX(jd: number): number {
    if (!contentBd) return 0;
    return ((jd - contentBd.left) / (contentBd.right - contentBd.left)) * width;
  }

  // Minimap drag
  const mmDrag = useRef(false);
  useEffect(() => {
    const el = minimapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.minimap')) {
        mmDrag.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const rect = el.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        if (contentBd) {
          const jd = contentBd.left + frac * (contentBd.right - contentBd.left);
          setVp((v) => ({ ...v, center: jd }));
        }
      }
    };
    const move = (e: PointerEvent) => {
      if (!mmDrag.current || !contentBd) return;
      const rect = el.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const jd = contentBd.left + frac * (contentBd.right - contentBd.left);
      setVp((v) => ({ ...v, center: jd }));
    };
    const up = () => { mmDrag.current = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
  }, [contentBd]);

  const zoom = (factor: number) =>
    setVp((v) => ({ ...v, px: clampPx(v.px * factor) }));

  return (
    <div className="tl-layout">
      <EntitySidebar />
      <div className="tl-main">
        <div className="toolbar">
          <button onClick={() => zoom(1.6)} title="Zoom ind (+)">＋</button>
          <button onClick={() => zoom(1 / 1.6)} title="Zoom ud (−)">－</button>
          <button onClick={fit}>Tilpas</button>
          {/* M15: Zoom-presets */}
          <span className="zoom-presets">
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 365.25) }))} title="Zoom til århundrede-overblik">årh.</button>
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 30) }))} title="Zoom til årtier">10 år</button>
            <button onClick={() => setVp((v) => ({ ...v, px: clampPx(1 / 3) }))} title="Zoom til enkeltår">3 år</button>
            <button onClick={() => {
              const allBds = rows.map((r) => r.bd);
              if (!allBds.length) return;
              const minA = Math.min(...allBds.map((b) => b.a));
              const maxB = Math.max(...allBds.map((b) => b.b));
              const newPx = clampPx((width - 40) / (maxB - minA));
              setVp({ center: (minA + maxB) / 2, px: newPx });
            }} title="Zoom til at passe alt på skærmen">⊞</button>
            <button onClick={() => {
              const dv = fromJD(vp.center, 'year');
              const id = addItemAction({ label: 'Nyt item', span: { start: dv, duration: { y: 1 } } });
              select(id); setEditLabelId(id);
            }} title="Tilføj item ved viewport-center">＋</button>
          </span>
          <button
            className={laneMode === 'type' ? 'on' : ''}
            onClick={() => setLaneMode((m) => m === 'chrono' ? 'type' : 'chrono')}
            title="Skift mellem kronologisk rækkefølge og spor pr. type"
          >
            {laneMode === 'type' ? '🔀 Spor pr. type' : '📅 Kronologisk'}
          </button>
          {/* Søg */}
          <div className="tl-search">
            <input
              type="text"
              placeholder="Søg post… (Ctrl+←/→ navigér)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  useApp.getState().jumpTo(searchResults[0].id);
                  setSearchQ('');
                }
                if (e.key === 'Escape') setSearchQ('');
              }}
            />
            {searchResults.length > 0 && (
              <ul className="tl-search-results">
                {searchResults.map((it) => (
                  <li key={it.id} onClick={() => { useApp.getState().jumpTo(it.id); setSearchQ(''); }}>
                    {it.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="count">
            {rows.length} daterede{hidden > 0 ? ` (${hidden} uden for view)` : ''}
            {clusters.length > 0 ? ` · ${clusters.length} klynger` : ''}
            {doc.items.length > rows.length + [...hiddenByCollapse].filter((id) => { const it = doc.items.find(i => i.id === id); return it && spanBounds(it.span); }).length
              ? ` · ${doc.items.length - rows.length - [...hiddenByCollapse].filter((id) => { const it = doc.items.find(i => i.id === id); return it && spanBounds(it.span); }).length} uden dato`
              : ''}
          </span>
        </div>

        {/* M13: Minimap */}
        {contentBd && (
          <div className="minimap" ref={minimapRef} style={{ height: MINIMAP_H, width }}>
            {/* content density bars */}
            {doc.items.map((it) => {
              const bd = spanBounds(it.span);
              if (!bd) return null;
              const x1 = minimapX(bd.a);
              const w = Math.max(1, minimapX(bd.b) - x1);
              const type = doc.itemTypes.find((t) => t.id === it.typeId);
              const color = it.color ?? type?.color ?? '#888';
              return <div key={it.id} className="minimap-bar" style={{ left: x1, width: w, background: color }} />;
            })}
            {/* viewport indicator */}
            <div
              className="minimap-viewport"
              style={{
                left: minimapX(left),
                width: Math.max(4, minimapX(right) - minimapX(left)),
              }}
            />
          </div>
        )}

        {/* M17: Era breadcrumb */}
        {activeEras.length > 0 && (
          <div className="era-breadcrumb">
            📍 {activeEras.map((e, i) => (
              <span key={e.id}>{i > 0 ? ' → ' : ''}<em style={{ color: e.color }}>{e.label}</em></span>
            ))}
          </div>
        )}

        <div className="tl" ref={wrapRef}>
          <div className="ruler" style={{ height: 30 }}>
            {ticks.map((t, i) => (
              <div key={i} className="tick" style={{ left: x(t.jd) }}>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
          <div className="lanes" style={{ height: Math.max(totalRows, 1) * ROW_H }}>
            {/* M14: Æra-bånd (baggrundsperioder) */}
            {eraBands.map((era) => {
              const ex = x(era.a);
              const exb = x(era.b);
              if (exb < -500 || ex > width + 500) return null;
              return (
                <div key={era.id} className="era-band" style={{ left: ex, width: exb - ex, background: era.color + '12', borderLeft: `2px solid ${era.color}44`, borderRight: `2px solid ${era.color}44` }} title={era.label}>
                  <span className="era-label" style={{ color: era.color }}>{era.label}</span>
                </div>
              );
            })}
            {ticks.map((t, i) => (
              <div key={i} className="grid" style={{ left: x(t.jd), height: '100%' }} />
            ))}
            {Array.from({ length: totalRows }, (_, i) => (
              <div key={i} className={`lanebg ${i % 2 ? 'alt' : ''}`} style={{ top: i * ROW_H, height: ROW_H }} />
            ))}

            {/* Lane labels (type mode) */}
            {laneGroups.map((lg, i) => (
              <div key={i} className="lane-label" style={{ top: lg.y * ROW_H - 2, color: lg.color }}>
                <span className="lane-label-dot" style={{ background: lg.color }} />
                {lg.typeName} ({lg.count})
              </div>
            ))}

            {/* M17: Vertical connectors parent↔child */}
            <svg className="connectors" width={width} height={Math.max(totalRows, 1) * ROW_H}>
              {visible.filter(({ it }) => it.parentId && rowYMap.has(it.parentId)).map(({ it, bd }) => {
                const parentY = rowYMap.get(it.parentId!)!;
                const childY = rowYMap.get(it.id)!;
                const cx = x((bd.a + bd.b) / 2);
                return <line key={`conn-${it.id}`} x1={cx} y1={parentY} x2={cx} y2={childY} stroke="#ffffff18" strokeWidth={1} strokeDasharray="2,3" />;
              })}
            </svg>

            {/* M21: "Nu"-linje */}
            {(() => {
              const now = new Date();
              const nowJD = toJD({ y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), precision: 'day' });
              const nx = x(nowJD);
              if (nx < 0 || nx > width) return null;
              return <div className="now-line" style={{ left: nx }} title="I dag" />;
            })()}

            {visible.map(({ it, bd, y }) => {
              const color = effectiveColor.get(it.id) ?? '#888';
              const xa = x(bd.a);
              const xb = x(bd.b);
              const w = Math.max(3, xb - xa);
              const hasChildren = (childrenMap.get(it.id)?.length ?? 0) > 0;
              const isCollapsed = collapsedIds.has(it.id);
              const tip = `${it.label} — ${formatSpan(it.span)}${formatUncertainty(it.span) ? ` (${formatUncertainty(it.span)})` : ''}${it.verseRefs?.length ? `\n📖 ${it.verseRefs.map((v) => `${v.bookSlug} ${v.ch}${v.vs ? ':' + v.vs : ''}`).join(', ')}` : ''}${it.tags?.length ? `\n🏷 ${it.tags.join(', ')}` : ''}`;
              return (
                <div key={it.id} draggable className={`bar ${w > 140 ? 'wide' : ''} ${selectedId === it.id ? 'selected' : ''} ${relatedIds.has(it.id) ? 'related' : ''} ${multiSelected.has(it.id) ? 'multi-sel' : ''}`} title={tip} onClick={(e) => { if (e.ctrlKey || e.metaKey) { toggleMulti(it.id); } else { select(it.id); setPopupId(popupId === it.id ? null : it.id); } }} onDoubleClick={(e) => { e.stopPropagation(); setEditLabelId(it.id); }} onDragStart={(e) => { e.dataTransfer.setData('text/tl-item', it.id); }} onDragOver={(e) => { if (e.dataTransfer.types.includes('text/tl-item')) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData('text/tl-item'); if (src && src !== it.id) updateItem(src, { parentId: it.id }); }} onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, itemId: it.id }); }} onMouseEnter={() => setHoveredId(it.id)} onMouseLeave={() => setHoveredId(null)} style={{ left: xa, top: y + 5, width: w, background: color }}>
                  {bd.ua !== undefined && bd.ua > bd.a && (
                    <span className="halo" style={{ left: x(bd.a) - xa, width: x(bd.ua) - x(bd.a), background: `linear-gradient(90deg, ${color}55, ${color}22)` }} />
                  )}
                  {bd.ub !== undefined && bd.ub < bd.b && (
                    <span className="halo" style={{ left: x(bd.ub) - xa, width: x(bd.b) - x(bd.ub), background: `linear-gradient(90deg, ${color}22, ${color}55)` }} />
                  )}
                  {it.span.ongoing && <span className="arrow" style={{ borderColor: color }} />}
                  {hasChildren && (
                    <button className={`bar-collapse ${isCollapsed ? 'collapsed' : ''}`} onClick={(e) => { e.stopPropagation(); toggleCollapse(it.id); }} title={isCollapsed ? `Vis ${childrenMap.get(it.id)!.length} children` : 'Skjul children'}>
                      {isCollapsed ? '+' : '−'}
                    </button>
                  )}
                  {pinnedIds.has(it.id) && <button className="bar-pin pinned" onClick={(e) => { e.stopPropagation(); togglePin(it.id); }} title="Fjern pin">📌</button>}
                  {!pinnedIds.has(it.id) && w > 100 && <button className="bar-pin" onClick={(e) => { e.stopPropagation(); togglePin(it.id); }} title="Fastgør i bunden">📍</button>}
                  {editLabelId === it.id ? (
                    <input className="bar-edit" autoFocus defaultValue={it.label} onBlur={(e) => { updateItem(it.id, { label: e.target.value || it.label }); setEditLabelId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { updateItem(it.id, { label: (e.target as HTMLInputElement).value || it.label }); setEditLabelId(null); } if (e.key === 'Escape') setEditLabelId(null); }} />
                  ) : (
                    <span className="barlabel" style={{ color: w > 140 ? '#fff' : color }}>
                      {it.imageId ? '🖼 ' : ''}{w > 26 ? it.label : ''}
                      {isCollapsed && (childrenMap.get(it.id)?.length ?? 0) > 0 && ` (+${childrenMap.get(it.id)!.length})`}
                      {!isCollapsed && (descCount.get(it.id) ?? 0) > 0 && <span className="desc-badge">{descCount.get(it.id)}</span>}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Klynge-bubbles */}
            {clusters.map((cl, i) => {
              const cx = x(cl.x);
              if (cx < -50 || cx > width + 50) return null;
              return (
                <div key={i} className="cluster" style={{ left: cx - 16, top: ROW_H / 2 - 16 }} title={`${cl.count} poster her. Klik for at zoome ind.`} onClick={() => setVp((v) => ({ center: cl.x, px: Math.min(0.1, v.px * 4) }))}>
                  {cl.count}
                </div>
              );
            })}

            {/* Dependency-pile + Profeti-buer (SVG overlay) */}
            <svg className="dep-overlay" width={width} height={Math.max(totalRows, 1) * ROW_H}>
              {(doc.dependencies ?? []).map((dep) => {
                const blockerRow = rows.find((r) => r.it.id === dep.blockerId);
                const blockedRow = rows.find((r) => r.it.id === dep.blockedId);
                if (!blockerRow || !blockedRow) return null;
                const violated = isDependencyViolated(dep, doc);
                const x1 = x(blockerRow.bd.b);
                const y1 = blockerRow.y + ROW_H / 2;
                const x2 = x(blockedRow.bd.a);
                const y2 = blockedRow.y + ROW_H / 2;
                if (x1 < -200 || x1 > width + 200 || x2 < -200 || x2 > width + 200) return null;
                const midY = (y1 + y2) / 2;
                const path = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
                return (
                  <g key={dep.id}>
                    <path d={path} fill="none" stroke={violated ? '#e74c3c' : '#888'} strokeWidth={violated ? 2 : 1} strokeDasharray={violated ? '' : '4 2'} markerEnd="url(#arrowhead)" />
                    <text x={(x1 + x2) / 2} y={midY - 4} textAnchor="middle" fontSize={9} fill={violated ? '#e74c3c' : '#666'}>{dep.kind}</text>
                  </g>
                );
              })}
              {(doc.relations ?? []).filter((r) => r.typeId === 'rt-fulfillment').map((rel) => {
                const prophecyRow = rows.find((r) => r.it.id === rel.fromId);
                const fulfillRow = rows.find((r) => r.it.id === rel.toId);
                if (!prophecyRow || !fulfillRow) return null;
                const x1 = x((prophecyRow.bd.a + prophecyRow.bd.b) / 2);
                const y1 = prophecyRow.y + ROW_H / 2;
                const x2 = x((fulfillRow.bd.a + fulfillRow.bd.b) / 2);
                const y2 = fulfillRow.y + ROW_H / 2;
                if (x1 < -200 || x1 > width + 200 || x2 < -200 || x2 > width + 200) return null;
                const arcH = Math.abs(y2 - y1) * 0.4 + 20;
                const midX = (x1 + x2) / 2;
                const path = `M${x1},${y1} Q${midX},${Math.min(y1, y2) - arcH} ${x2},${y2}`;
                return (
                  <g key={rel.id} className="fulfill-arc">
                    <path d={path} fill="none" stroke="#d4a017" strokeWidth={2} strokeLinecap="round" opacity={0.8} markerEnd="url(#arrow-gold)" />
                    <circle cx={x1} cy={y1} r={4} fill="#d4a017" opacity={0.9} />
                    <text x={midX} y={Math.min(y1, y2) - arcH + 2} textAnchor="middle" fontSize={10} fill="#d4a017">📜</text>
                  </g>
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#888" />
                </marker>
                <marker id="arrow-gold" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="#d4a017" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
        {/* M14: Dato-løse poster */}
        {datelessItems.length > 0 && (
          <div className={`dateless-section ${collapsedIds.has('grp:dateless') ? 'collapsed' : ''}`}>
            <button className="dateless-toggle" onClick={() => toggleCollapse('grp:dateless')}>
              {collapsedIds.has('grp:dateless') ? '▶' : '▼'} Uden dato ({datelessItems.length})
            </button>
            {!collapsedIds.has('grp:dateless') && (
              <div className="dateless-chips">
                {datelessItems.map((it) => {
                  const color = effectiveColor.get(it.id) ?? '#888';
                  return (
                    <span key={it.id} className={`dateless-chip ${selectedId === it.id ? 'selected' : ''}`} style={{ borderColor: color, background: color + '18' }} onClick={() => { select(it.id); jumpTo(it.id); }}>
                      {it.imageId ? '🖼 ' : ''}{it.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* M17: Pinned strip */}
        {pinnedIds.size > 0 && (
          <div className="pinned-strip">
            <span className="pinned-label">📌 Fastgjorte:</span>
            {[...pinnedIds].map((id) => {
              const it = doc.items.find((x) => x.id === id);
              if (!it) return null;
              const color = effectiveColor.get(id) ?? '#888';
              return (
                <span key={id} className={`pinned-chip ${selectedId === id ? 'selected' : ''}`} style={{ borderColor: color, background: color + '22' }} onClick={() => { select(id); jumpTo(id); }} onContextMenu={(e) => { e.preventDefault(); togglePin(id); }}>
                  {it.label}
                </span>
              );
            })}
          </div>
        )}
        <p className="hint">Træk = pan · Hjul/+/− = zoom · Ctrl+←/→ = forrige/næste · Søg = hop til · Klik minimap = jump · 📍 pin · Ctrl+klik = multivælg</p>

        {/* M19: Multi-select bulk actions */}
        {multiSelected.size > 0 && (
          <div className="bulk-bar">
            <span>{multiSelected.size} valgt</span>
            <button onClick={() => { multiSelected.forEach((id) => togglePin(id)); }}>📍 Pin alle</button>
            <button onClick={() => { multiSelected.forEach((id) => duplicateItem(id)); clearMulti(); }}>📋 Duplikér</button>
            <label className="bulk-color" title="Sæt farve på alle valgte">🎨 <input type="color" onChange={(e) => { multiSelected.forEach((id) => setItemColor(id, e.target.value)); }} /></label>
            <button onClick={() => { const tag = prompt('Nyt tag:'); if (tag) multiSelected.forEach((id) => { const it = doc.items.find((x) => x.id === id); if (it) updateItem(id, { tags: [...(it.tags ?? []), tag] }); }); }}>🏷 Tag</button>
            <button onClick={() => { const ids = [...multiSelected]; ids.forEach((id) => removeItem(id)); clearMulti(); }} className="ctx-danger">🗑 Slet alle</button>
            <button onClick={clearMulti}>✕ Ryd</button>
          </div>
        )}

        {/* M18: Context menu */}
        {ctxMenu && (
          <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={() => setCtxMenu(null)}>
            <button onClick={() => { select(ctxMenu.itemId); setPopupId(ctxMenu.itemId); }}>ℹ️ Vis detaljer</button>
            <button onClick={() => {
              const it = doc.items.find((x) => x.id === ctxMenu.itemId);
              if (it) setFilter({ ...(activeFilter ?? { match: 'all' as const }), types: [it.typeId] });
            }}>🔍 Filtrér på type</button>
            <button onClick={() => {
              const it = doc.items.find((x) => x.id === ctxMenu.itemId);
              if (it?.parentId) setFilter({ ...(activeFilter ?? { match: 'all' as const }), parentId: it.parentId });
            }}>🌲 Vis søskende</button>
            <button onClick={() => togglePin(ctxMenu.itemId)}>
              {pinnedIds.has(ctxMenu.itemId) ? '📌 Fjern pin' : '📍 Fastgør'}
            </button>
            {doc.items.find((x) => x.id === ctxMenu.itemId)?.parentId && (
              <button onClick={() => jumpTo(doc.items.find((x) => x.id === ctxMenu.itemId)!.parentId!)}>⬆ Gå til forælder</button>
            )}
            <hr />
            <label className="ctx-color">🎨 Farve: <input type="color" value={doc.items.find((x) => x.id === ctxMenu.itemId)?.color ?? '#888888'} onChange={(e) => setItemColor(ctxMenu.itemId, e.target.value)} /></label>
            <button className="ctx-danger" onClick={() => { if (confirm('Slet item?')) removeItem(ctxMenu.itemId); }}>🗑 Slet</button>
          </div>
        )}

        {/* M16: Detail-popup */}
        {popupId && (() => {
          const it = doc.items.find((x) => x.id === popupId);
          if (!it) return null;
          const bd = spanBounds(it.span);
          const px = bd ? x(bd.a) : width / 2;
          const type = doc.itemTypes.find((t) => t.id === it.typeId);
          return (
            <div className="tl-popup" style={{ left: Math.max(10, Math.min(px, width - 260)) }}>
              <button className="tl-popup-close" onClick={() => setPopupId(null)}>✕</button>
              {it.imageId && <ItemImage imageId={it.imageId} size={120} />}
              <h4>{it.label}</h4>
              <div className="tl-popup-dates">{formatSpan(it.span)}</div>
              {type && <span className="tl-popup-type" style={{ background: type.color }}>{type.name}</span>}
              {it.verseRefs?.length ? <div className="tl-popup-verses">📖 {it.verseRefs.map((v) => `${v.bookSlug} ${v.ch}${v.vs ? ':' + v.vs : ''}`).join(', ')}</div> : null}
              {it.tags?.length ? <div className="tl-popup-tags">{it.tags.map((t) => <span key={t} className="tag-chip">{t}</span>)}</div> : null}
              {it.notes && <p className="tl-popup-notes">{it.notes}</p>}
              {(childrenMap.get(it.id)?.length ?? 0) > 0 && (
                <div className="tl-popup-children">
                  <strong>Børn ({childrenMap.get(it.id)!.length}):</strong>
                  <ul>{childrenMap.get(it.id)!.map((cid) => {
                    const child = doc.items.find((c) => c.id === cid);
                    return child ? <li key={cid} onClick={() => { select(cid); jumpTo(cid); }}>{child.label}</li> : null;
                  })}</ul>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
